import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { Album } from '@/types/music'
import { getAvailableLibrary, letterOf, LIBRARY_PATH, LibraryData } from '@/utils/libraryStore'

export const dynamic = 'force-dynamic'

function matchesLetter(album: Album, letter: string | null): boolean {
  return letter === null || letterOf(album.title) === letter
}

/** Grid cards don't need the setlist text (it is most of an album's size) */
function forGrid(album: Album): Album {
  if (!album.setlistInfo) return album
  const card = { ...album }
  delete card.setlistInfo
  return card
}

// GET /api/albums — the albums that are on disk, one page at a time.
//
//   ?page=N&limit=M   page N (1-based) of M albums; limit=0 returns no albums, only the
//                     library info (scan locations, counts, letters)
//   &letter=X         only albums whose title starts with X ('A'–'Z', '#' digits, '~' other)
//
// Without page/limit every album is returned (large for big libraries; the UI never asks
// for that). Albums for a single screen come from /api/albums/[id].
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const params = request.nextUrl.searchParams
    const library = await getAvailableLibrary()
    const letterParam = params.get('letter')
    const letter = letterParam ? letterParam : null

    const meta = {
      scanPaths: library.scanPaths,
      lastScanned: library.lastScanned,
      totalFiles: library.totalFiles,
      totalAlbums: library.albums.length,
      scanResults: library.scanResults,
    }

    if (!params.has('page') && !params.has('limit')) {
      return NextResponse.json({ ...meta, albums: library.albums })
    }

    const limit = Math.max(0, parseInt(params.get('limit') ?? '', 10) || 0)
    const page = Math.max(1, parseInt(params.get('page') ?? '', 10) || 1)
    const matching = letter === null ? library.albums : library.albums.filter(a => matchesLetter(a, letter))
    const letters = Array.from(new Set(library.albums.map(a => letterOf(a.title)))).sort()
    const albums = limit > 0 ? matching.slice((page - 1) * limit, page * limit).map(forGrid) : []

    return NextResponse.json({
      ...meta,
      albums,
      page,
      limit,
      letter,
      matchingAlbums: matching.length,
      totalPages: limit > 0 ? Math.max(1, Math.ceil(matching.length / limit)) : 1,
      letters,
    })
  } catch (error) {
    console.error('Error loading albums:', error)
    return NextResponse.json({ error: 'Failed to load albums' }, { status: 500 })
  }
}

// Remove a scan location from the library. This deletes the location from the
// saved scan paths/results and drops every album that lives within that
// location. Files on disk are left untouched — only the library index is edited.
export function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const location = searchParams.get('path')?.trim()

    if (!location) {
      return Promise.resolve(NextResponse.json(
        { error: 'A "path" query parameter is required' },
        { status: 400 }
      ))
    }

    const dataPath = LIBRARY_PATH

    if (!fs.existsSync(dataPath)) {
      // Nothing persisted yet — treat as already removed.
      return Promise.resolve(NextResponse.json({ success: true, scanPaths: [], totalAlbums: 0 }))
    }

    const data = fs.readFileSync(dataPath, 'utf8')
    const libraryData = JSON.parse(data) as LibraryData

    const albums = libraryData.albums ?? []
    const scanPaths = libraryData.scanPaths ?? (libraryData.scanPath ? [libraryData.scanPath] : [])
    const scanResults = libraryData.scanResults ?? {}

    // Normalize away trailing separators so comparisons are stable.
    const normalize = (p: string): string => p.replace(/[/\\]+$/, '')
    const target = normalize(location)
    const isWithin = (p: string): boolean => {
      const n = normalize(p)
      return n === target || n.startsWith(target + path.sep)
    }

    const remainingAlbums = albums.filter(album => !(album.folderPath !== undefined && isWithin(album.folderPath)))
    const remainingScanPaths = scanPaths.filter(p => !isWithin(p))

    const remainingScanResults: NonNullable<LibraryData['scanResults']> = {}
    for (const [key, value] of Object.entries(scanResults)) {
      if (!isWithin(key)) {
        remainingScanResults[key] = value
      }
    }

    const updatedLibrary: LibraryData = {
      ...libraryData,
      albums: remainingAlbums,
      scanPaths: remainingScanPaths,
      totalAlbums: remainingAlbums.length,
      totalFiles: remainingAlbums.reduce((sum, album) => sum + album.tracks.length, 0),
      scanResults: remainingScanResults,
    }

    // Drop the legacy single-path field if it referenced the removed location.
    if (updatedLibrary.scanPath && isWithin(updatedLibrary.scanPath)) {
      delete updatedLibrary.scanPath
    }

    fs.writeFileSync(dataPath, JSON.stringify(updatedLibrary, null, 2))

    return Promise.resolve(NextResponse.json({
      success: true,
      scanPaths: remainingScanPaths,
      totalAlbums: remainingAlbums.length,
    }))

  } catch (error) {
    console.error('Error removing location:', error)
    return Promise.resolve(NextResponse.json(
      { error: 'Failed to remove location' },
      { status: 500 }
    ))
  }
}