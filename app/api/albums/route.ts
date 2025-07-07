import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { Album } from '@/types/music'

interface LibraryData {
  albums: Album[]
  scanPaths?: string[]
  scanPath?: string
  lastScanned?: string | null
  totalFiles?: number
  totalAlbums?: number
  scanResults?: Record<string, unknown>
}

export function GET(): Promise<NextResponse> {
  try {
    const dataPath = path.join(process.cwd(), 'data', 'music-library.json')
    
    if (!fs.existsSync(dataPath)) {
      return Promise.resolve(NextResponse.json({
        albums: [],
        scanPaths: [],
        lastScanned: null,
        totalFiles: 0,
        totalAlbums: 0,
        scanResults: {}
      }))
    }

    const data = fs.readFileSync(dataPath, 'utf8')
    const libraryData = JSON.parse(data) as LibraryData

    // Handle both old and new data formats
    const albums = libraryData.albums ?? []
    const scanPaths = libraryData.scanPaths ?? (libraryData.scanPath ? [libraryData.scanPath] : [])
    const lastScanned = libraryData.lastScanned ?? null
    const totalFiles = libraryData.totalFiles ?? 0
    const totalAlbums = libraryData.totalAlbums ?? albums.length
    const scanResults = libraryData.scanResults ?? {}

    return Promise.resolve(NextResponse.json({
      albums,
      scanPaths,
      lastScanned,
      totalFiles,
      totalAlbums,
      scanResults
    }))

  } catch (error) {
    console.error('Error loading albums:', error)
    return Promise.resolve(NextResponse.json(
      { error: 'Failed to load albums' },
      { status: 500 }
    ))
  }
} 