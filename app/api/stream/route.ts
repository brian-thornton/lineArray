import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { Readable } from 'stream'
import logger from '@/utils/serverLogger'

// GET /api/stream?path=<abs path>            — raw file, with HTTP Range support
// GET /api/stream?path=<abs path>&transcode=1&start=<sec>
//                                            — ffmpeg → MP3 for formats the browser can't decode
// GET /api/stream?path=<abs path>&meta=1     — { duration } via ffprobe (used by transcoded playback)
//
// Only files that exist in the scanned library can be streamed, so this can't be
// used to read arbitrary files off the host.

export const dynamic = 'force-dynamic'

const LIBRARY_PATH = path.join(process.cwd(), 'data', 'music-library.json')

const MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.webm': 'audio/webm',
  '.aif': 'audio/aiff',
  '.aiff': 'audio/aiff',
  '.wma': 'audio/x-ms-wma',
}

interface LibraryCache {
  mtimeMs: number
  paths: Set<string>
}

const _g = global as typeof globalThis & { __streamLibraryCache?: LibraryCache }

function getLibraryPaths(): Set<string> {
  const stat = fs.statSync(LIBRARY_PATH)
  const cached = _g.__streamLibraryCache
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.paths

  const library = JSON.parse(fs.readFileSync(LIBRARY_PATH, 'utf-8')) as { albums?: Array<{ tracks?: Array<{ path: string }> }> }
  const paths = new Set<string>()
  for (const album of library.albums ?? []) {
    for (const track of album.tracks ?? []) paths.add(track.path)
  }
  _g.__streamLibraryCache = { mtimeMs: stat.mtimeMs, paths }
  return paths
}

function isLibraryTrack(filePath: string): boolean {
  try {
    return getLibraryPaths().has(filePath)
  } catch {
    return false
  }
}

// Node → web stream with backpressure. Readable.toWeb() is not used because on
// Node 20 it throws an uncaught ERR_INVALID_STATE (crashing the server) when the
// browser cancels mid-transfer — which happens on every skip and seek.
function toWebStream(source: Readable, onCancel?: () => void): ReadableStream<Uint8Array> {
  let done = false
  const finish = (): void => {
    if (done) return
    done = true
    source.destroy()
    onCancel?.()
  }
  return new ReadableStream<Uint8Array>({
    start(controller) {
      source.on('data', (chunk: Buffer) => {
        if (done) return
        try {
          controller.enqueue(chunk)
          if ((controller.desiredSize ?? 1) <= 0) source.pause()
        } catch {
          finish()
        }
      })
      source.on('end', () => {
        if (done) return
        done = true
        try { controller.close() } catch { /* already cancelled */ }
      })
      source.on('error', error => {
        if (done) return
        done = true
        try { controller.error(error) } catch { /* already cancelled */ }
      })
    },
    pull() {
      source.resume()
    },
    cancel() {
      finish()
    },
  })
}

function probeDuration(filePath: string): Promise<number | null> {
  return new Promise(resolve => {
    const proc = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath])
    let out = ''
    proc.stdout.on('data', (chunk: Buffer) => { out += chunk.toString() })
    proc.on('error', () => resolve(null))
    proc.on('close', () => {
      const duration = parseFloat(out.trim())
      resolve(Number.isFinite(duration) ? duration : null)
    })
  })
}

function transcode(request: NextRequest, filePath: string, start: number): NextResponse {
  const args = ['-hide_banner', '-loglevel', 'error']
  if (start > 0) args.push('-ss', String(start))
  args.push('-i', filePath, '-vn', '-map', '0:a:0', '-codec:a', 'libmp3lame', '-b:a', '256k', '-f', 'mp3', 'pipe:1')

  const proc = spawn('ffmpeg', args)
  proc.on('error', error => logger.error('ffmpeg failed to start', 'Stream', error))
  proc.stderr.on('data', (chunk: Buffer) => logger.warn(`ffmpeg: ${chunk.toString().trim()}`, 'Stream'))
  // Browser skipped/seeked/closed — don't leave ffmpeg running.
  const kill = (): void => { proc.kill('SIGKILL') }
  request.signal.addEventListener('abort', kill)

  return new NextResponse(toWebStream(proc.stdout, kill), {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams
  const filePath = params.get('path')
  if (!filePath) {
    return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 })
  }
  if (!isLibraryTrack(filePath) || !fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Track not found in library' }, { status: 404 })
  }

  if (params.get('meta') === '1') {
    return NextResponse.json({ duration: await probeDuration(filePath) })
  }

  if (params.get('transcode') === '1') {
    const start = Math.max(0, parseFloat(params.get('start') ?? '0') || 0)
    return transcode(request, filePath, start)
  }

  const { size } = fs.statSync(filePath)
  const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  const baseHeaders = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
  }

  const range = request.headers.get('range')
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null
  if (match) {
    let start: number
    let end: number
    if (match[1] === '') {
      // Suffix range: last N bytes
      start = Math.max(0, size - parseInt(match[2], 10))
      end = size - 1
    } else {
      start = parseInt(match[1], 10)
      end = match[2] ? Math.min(parseInt(match[2], 10), size - 1) : size - 1
    }
    if (start >= size || start > end) {
      return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    }
    const stream = fs.createReadStream(filePath, { start, end })
    request.signal.addEventListener('abort', () => stream.destroy())
    return new NextResponse(toWebStream(stream), {
      status: 206,
      headers: {
        ...baseHeaders,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(end - start + 1),
      },
    })
  }

  const stream = fs.createReadStream(filePath)
  request.signal.addEventListener('abort', () => stream.destroy())
  return new NextResponse(toWebStream(stream), {
    headers: { ...baseHeaders, 'Content-Length': String(size) },
  })
}
