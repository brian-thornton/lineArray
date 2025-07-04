import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const albumId = params.id
    const dataPath = path.join(process.cwd(), 'data', 'music-library.json')
    
    if (!fs.existsSync(dataPath)) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 })
    }

    const data = fs.readFileSync(dataPath, 'utf8')
    const libraryData = JSON.parse(data)
    const albums = libraryData.albums || []

    const album = albums.find((a: any) => a.id === albumId)
    
    if (!album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 })
    }

    return NextResponse.json(album)

  } catch (error) {
    console.error('Error loading album:', error)
    return NextResponse.json(
      { error: 'Failed to load album' },
      { status: 500 }
    )
  }
} 