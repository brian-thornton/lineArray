import { NextRequest, NextResponse } from 'next/server'
import { getAvailableAlbum } from '@/utils/libraryStore'

export const dynamic = 'force-dynamic'

// GET /api/albums/[id] — one album with the tracks that are on disk right now.
// 404 when the album isn't in the library or none of its files can be found.
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const album = await getAvailableAlbum(params.id)
    if (!album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 })
    }
    return NextResponse.json(album)
  } catch (error) {
    console.error('Error loading album:', error)
    return NextResponse.json({ error: 'Failed to load album' }, { status: 500 })
  }
}
