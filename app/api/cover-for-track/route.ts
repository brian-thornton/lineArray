import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { memoByLibrary } from '@/utils/libraryStore'

/** Cover image per track folder, from the first album with a track in that folder */
function coverByFolder(): Map<string, string | undefined> {
  return memoByLibrary('coverByFolder', ({ albums }) => {
    const covers = new Map<string, string | undefined>()
    for (const album of albums) {
      for (const track of album.tracks) {
        const dir = path.dirname(track.path)
        if (!covers.has(dir)) covers.set(dir, album.coverPath)
      }
    }
    return covers
  })
}

export function GET(request: NextRequest): NextResponse {
  const trackPath = request.nextUrl.searchParams.get('path')
  if (!trackPath) {
    return new NextResponse('Missing path parameter', { status: 400 })
  }

  try {
    // Find the album whose tracks include this track path (match by directory)
    const coverPath = coverByFolder().get(path.dirname(trackPath))

    if (!coverPath || !fs.existsSync(coverPath)) {
      return new NextResponse('Cover not found', { status: 404 })
    }

    const imageBuffer = fs.readFileSync(coverPath)
    const ext = path.extname(coverPath).toLowerCase()
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
