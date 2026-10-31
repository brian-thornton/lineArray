import { NextRequest, NextResponse } from 'next/server'
import logger from '@/utils/serverLogger'
import { trackInfoForPaths } from '@/utils/playlistAlbumInfo'

const MAX_PATHS = 500

// POST /api/tracks/info - clean titles, album and cover for a list of track paths (used by Up Next)
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { paths } = await request.json() as { paths?: unknown }
    if (!Array.isArray(paths) || !paths.every(p => typeof p === 'string')) {
      return NextResponse.json({ error: 'paths must be an array of strings' }, { status: 400 })
    }
    return NextResponse.json({ tracks: trackInfoForPaths(paths.slice(0, MAX_PATHS)) })
  } catch (error) {
    logger.error('Error looking up track info', 'TracksInfoAPI', error)
    return NextResponse.json({ error: 'Failed to look up tracks' }, { status: 500 })
  }
}
