// Shared, in-memory view of data/music-library.json for server routes.
//
// The library file can be tens of MB (a 6k-album library is ~50 MB), so routes must not
// read and parse it per request. getLibrary() parses it once and re-reads only when the
// file's mtime/size changes (a scan or admin edit rewrote it).
//
// "Which albums and tracks are on disk right now" (removable media, deleted files) is
// answered by getAvailableLibrary(). It lists each album/track folder once, in parallel,
// instead of stat-ing every track, and caches the answer: under Docker Desktop on macOS
// every filesystem call crosses into the host, and ~120k sequential existsSync calls made
// the first library load after a restart take many seconds. The cached answer is served
// immediately and refreshed in the background once it is older than AVAILABILITY_TTL_MS.
//
// State lives on globalThis because Next.js can load this module more than once
// (instrumentation, each route bundle) in the same process.
//
// Everything returned here is shared: callers must treat it as read-only. Code that edits
// the library (scan, admin cover routes) reads and writes the file itself; the cache picks
// the change up from the new mtime.

import fs from 'fs'
import path from 'path'
import { Album, Track } from '@/types/music'

export const LIBRARY_PATH = path.join(process.cwd(), 'data', 'music-library.json')

const AVAILABILITY_TTL_MS = 30_000
const LISTING_CONCURRENCY = 32

export interface ScanResult {
  albums: number
  files: number
  lastScanned: string
  status?: string
  reason?: string
}

export interface LibraryData {
  albums: Album[]
  scanPaths?: string[]
  scanPath?: string
  lastScanned?: string | null
  totalFiles?: number
  totalAlbums?: number
  scanResults?: Record<string, ScanResult>
}

export interface Library {
  /** Changes whenever the file is rewritten */
  version: string
  data: LibraryData
}

export interface AvailableLibrary {
  version: string
  checkedAt: number
  /** Albums with at least one track on disk; tracks not on disk are removed */
  albums: Album[]
  scanPaths: string[]
  lastScanned: string | null
  totalFiles: number
  scanResults: Record<string, ScanResult>
}

interface AvailabilityState {
  result?: AvailableLibrary
  inflight?: Promise<AvailableLibrary>
  inflightVersion?: string
}

type StoreGlobal = typeof globalThis & {
  __libraryCache?: Library
  __libraryAvailability?: AvailabilityState
  __libraryDerived?: Map<string, { version: string; value: unknown }>
}
const g = globalThis as StoreGlobal

const EMPTY: Library = { version: 'none', data: { albums: [] } }

function fileVersion(): string | null {
  try {
    const s = fs.statSync(LIBRARY_PATH)
    return `${s.mtimeMs}:${s.size}`
  } catch {
    return null
  }
}

/** The parsed library file (empty when there is none). Read-only. */
export function getLibrary(): Library {
  const version = fileVersion()
  if (version === null) return EMPTY
  const cached = g.__libraryCache
  if (cached && cached.version === version) return cached

  const data = JSON.parse(fs.readFileSync(LIBRARY_PATH, 'utf-8')) as LibraryData
  data.albums = data.albums ?? []
  const library = { version, data }
  g.__libraryCache = library
  return library
}

/**
 * A value computed from the library (an index, a lookup set), rebuilt only when the
 * library file changes. `key` must be unique per kind of value.
 */
export function memoByLibrary<T>(key: string, build: (library: LibraryData) => T): T {
  const library = getLibrary()
  const derived = (g.__libraryDerived ??= new Map<string, { version: string; value: unknown }>())
  const hit = derived.get(key)
  if (hit && hit.version === library.version) return hit.value as T
  const value = build(library.data)
  derived.set(key, { version: library.version, value })
  return value
}

// ── Availability ────────────────────────────────────────────────────────────

/** Directory listings for the given folders; null where the folder can't be read */
async function listFolders(folders: Iterable<string>): Promise<Map<string, Set<string> | null>> {
  const queue = Array.from(new Set(folders))
  const listings = new Map<string, Set<string> | null>()
  const worker = async (): Promise<void> => {
    for (let dir = queue.pop(); dir !== undefined; dir = queue.pop()) {
      try {
        listings.set(dir, new Set(await fs.promises.readdir(dir)))
      } catch {
        listings.set(dir, null)
      }
    }
  }
  await Promise.all(Array.from({ length: LISTING_CONCURRENCY }, worker))
  return listings
}

function foldersFor(album: Album): string[] {
  const folders = album.folderPath ? [album.folderPath] : []
  for (const track of album.tracks) folders.push(path.dirname(track.path))
  return folders
}

/**
 * The album with only the tracks that are on disk, or null when its folder is gone.
 * Skips macOS "._" resource-fork files.
 */
function availableAlbum(album: Album, listings: Map<string, Set<string> | null>): Album | null {
  // Albums without a recorded folder can't be verified, so treat them as unavailable
  if (!album.folderPath || !listings.get(album.folderPath)) return null
  const tracks = album.tracks.filter((track: Track) => {
    const name = path.basename(track.path)
    if (name.startsWith('._')) return false
    return listings.get(path.dirname(track.path))?.has(name) === true
  })
  return tracks.length > 0 ? (tracks.length === album.tracks.length ? album : { ...album, tracks }) : null
}

/** One album as it is on disk right now (checks only that album's folders) */
export async function getAvailableAlbum(id: string): Promise<Album | null> {
  const album = getLibrary().data.albums.find(a => a.id === id)
  if (!album) return null
  return availableAlbum(album, await listFolders(foldersFor(album)))
}

async function computeAvailability(library: Library): Promise<AvailableLibrary> {
  const { data } = library
  const { albums } = data
  const scanPaths = data.scanPaths ?? (data.scanPath ? [data.scanPath] : [])
  const scanResults: Record<string, ScanResult> = { ...(data.scanResults ?? {}) }

  const listings = await listFolders(albums.flatMap(foldersFor))

  const available: Album[] = []
  const accessibleFolders = new Set<string>()
  const now = new Date().toISOString()
  for (const album of albums) {
    const folder = album.folderPath ?? ''
    if (folder && listings.get(folder)) {
      accessibleFolders.add(folder)
    } else if (folder) {
      scanResults[folder] = {
        albums: 0, files: 0, lastScanned: now,
        status: 'unavailable', reason: 'Directory not found or not accessible'
      }
    }
    const result = availableAlbum(album, listings)
    if (result) available.push(result)
  }

  for (const folder of Array.from(accessibleFolders)) {
    if (scanResults[folder]) scanResults[folder] = { ...scanResults[folder], status: 'available' }
  }
  await Promise.all(scanPaths.map(async scanPath => {
    if (accessibleFolders.has(scanPath)) return
    const exists = await fs.promises.access(scanPath).then(() => true, () => false)
    if (!exists) {
      scanResults[scanPath] = {
        albums: 0, files: 0, lastScanned: now,
        status: 'unavailable', reason: 'Directory not found or not accessible'
      }
    }
  }))

  return {
    version: library.version,
    checkedAt: Date.now(),
    albums: available,
    scanPaths,
    lastScanned: data.lastScanned ?? null,
    totalFiles: data.totalFiles ?? 0,
    scanResults
  }
}

function startCheck(state: AvailabilityState, library: Library): Promise<AvailableLibrary> {
  if (state.inflight && state.inflightVersion === library.version) return state.inflight
  const run = computeAvailability(library)
    .then(result => {
      // The file may have been rewritten while this ran; don't let an old check win
      if (!state.result || result.version === getLibrary().version) state.result = result
      return result
    })
    .finally(() => {
      if (state.inflight === run) {
        state.inflight = undefined
        state.inflightVersion = undefined
      }
    })
  state.inflight = run
  state.inflightVersion = library.version
  return run
}

/**
 * The library as it is on disk. Returns the cached check right away (refreshing it in the
 * background when stale); waits only when there is no check for the current library file.
 */
export function getAvailableLibrary(): Promise<AvailableLibrary> {
  const library = getLibrary()
  const state = (g.__libraryAvailability ??= {})
  const cached = state.result
  if (cached && cached.version === library.version) {
    if (Date.now() - cached.checkedAt > AVAILABILITY_TTL_MS) {
      startCheck(state, library).catch(error => console.error('Library availability check failed:', error))
    }
    return Promise.resolve(cached)
  }
  return startCheck(state, library)
}

/** Load the library and check what's on disk, so the first page load doesn't wait */
export async function warmLibrary(): Promise<void> {
  const started = Date.now()
  try {
    const available = await getAvailableLibrary()
    console.log(`Library ready: ${available.albums.length} albums in ${Date.now() - started}ms`)
  } catch (error) {
    console.error('Library warm-up failed:', error)
  }
}

// ── Library pages ───────────────────────────────────────────────────────────

/** Letter-index bucket for an album title: 'A'–'Z', '#' for digits, '~' for anything else */
export function letterOf(title: string): string {
  const c = title.charAt(0).toUpperCase()
  if (/[0-9]/.test(c)) return '#'
  if (/[A-Z]/.test(c)) return c
  return '~'
}
