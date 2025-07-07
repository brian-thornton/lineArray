import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { Album } from '@/types/music'

export function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const albumId = params.id
    const dataPath = path.join(process.cwd(), 'data', 'music-library.json')
    
    if (!fs.existsSync(dataPath)) {
      return Promise.resolve(NextResponse.json({ error: 'Album not found' }, { status: 404 }))
    }

    const data = fs.readFileSync(dataPath, 'utf8')
    const libraryData = JSON.parse(data) as { albums: Album[] }
    const albums = libraryData.albums ?? []

    const album = albums.find((a: Album) => a.id === albumId)
    
    if (!album) {
      return Promise.resolve(NextResponse.json({ error: 'Album not found' }, { status: 404 }))
    }

    return Promise.resolve(NextResponse.json(album))

  } catch (error) {
    console.error('Error loading album:', error)
    return Promise.resolve(NextResponse.json(
      { error: 'Failed to load album' },
      { status: 500 }
    ))
  }
} 