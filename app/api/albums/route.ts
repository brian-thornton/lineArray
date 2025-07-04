import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), 'data', 'music-library.json')
    
    if (!fs.existsSync(dataPath)) {
      return NextResponse.json({
        albums: [],
        scanPaths: [],
        lastScanned: null,
        totalFiles: 0,
        totalAlbums: 0,
        scanResults: {}
      })
    }

    const data = fs.readFileSync(dataPath, 'utf8')
    const libraryData = JSON.parse(data)

    // Handle both old and new data formats
    const albums = libraryData.albums || []
    const scanPaths = libraryData.scanPaths || (libraryData.scanPath ? [libraryData.scanPath] : [])
    const lastScanned = libraryData.lastScanned || null
    const totalFiles = libraryData.totalFiles || 0
    const totalAlbums = libraryData.totalAlbums || albums.length
    const scanResults = libraryData.scanResults || {}

    return NextResponse.json({
      albums,
      scanPaths,
      lastScanned,
      totalFiles,
      totalAlbums,
      scanResults
    })

  } catch (error) {
    console.error('Error loading albums:', error)
    return NextResponse.json(
      { error: 'Failed to load albums' },
      { status: 500 }
    )
  }
} 