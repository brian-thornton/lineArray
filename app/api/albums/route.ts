import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), 'data', 'music-library.json')
    
    if (!fs.existsSync(dataPath)) {
      return NextResponse.json({
        albums: [],
        scanPath: '',
        lastScanned: null
      })
    }

    const data = fs.readFileSync(dataPath, 'utf8')
    const libraryData = JSON.parse(data)

    return NextResponse.json({
      albums: libraryData.albums || [],
      scanPath: libraryData.scanPath || '',
      lastScanned: libraryData.lastScanned || null,
      totalFiles: libraryData.totalFiles || 0,
      totalAlbums: libraryData.totalAlbums || 0
    })

  } catch (error) {
    console.error('Error loading albums:', error)
    return NextResponse.json(
      { error: 'Failed to load albums' },
      { status: 500 }
    )
  }
} 