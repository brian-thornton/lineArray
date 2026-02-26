import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface LibraryTrack {
  path: string
}

interface LibraryAlbum {
  coverPath?: string
  tracks: LibraryTrack[]
}

interface MusicLibrary {
  albums: LibraryAlbum[]
}

export function GET(request: NextRequest): NextResponse {
  const trackPath = request.nextUrl.searchParams.get('path')
  if (!trackPath) {
    return new NextResponse('Missing path parameter', { status: 400 })
  }

  try {
    const libraryPath = path.join(process.cwd(), 'data', 'music-library.json')
    if (!fs.existsSync(libraryPath)) {
      return new NextResponse('Library not found', { status: 404 })
    }

    const library = JSON.parse(fs.readFileSync(libraryPath, 'utf-8')) as MusicLibrary
    const trackDir = path.dirname(trackPath)

    // Find the album whose tracks include this track path (match by directory)
    const album = library.albums.find(a =>
      a.tracks.some(t => path.dirname(t.path) === trackDir)
    )

    if (!album?.coverPath || !fs.existsSync(album.coverPath)) {
      return new NextResponse('Cover not found', { status: 404 })
    }

    const imageBuffer = fs.readFileSync(album.coverPath)
    const ext = path.extname(album.coverPath).toLowerCase()
    const contentTypeMap: Record<string, string> = {
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    }
    const contentType = contentTypeMap[ext] ?? 'image/jpeg'

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Error serving cover for track:', error)
    return new NextResponse('Error serving cover', { status: 500 })
  }
}
