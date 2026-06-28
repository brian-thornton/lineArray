import { NextRequest, NextResponse } from 'next/server'
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

    // Check directory accessibility and update scan results
    const updatedScanResults = { ...scanResults }
    const accessibleDirectories = new Set<string>()
    
    // Filter out tracks from unavailable directories (removable media)
    const filteredAlbums = albums.map(album => {
      // Check if album folder is still accessible
      const isAlbumAccessible = fs.existsSync(album.folderPath)
      
      if (!isAlbumAccessible) {
        // Mark directory as unavailable in scan results
        const directory = album.folderPath
        updatedScanResults[directory] = {
          albums: 0,
          files: 0,
          lastScanned: new Date().toISOString(),
          status: 'unavailable',
          reason: 'Directory not found or not accessible'
        }
        // Return album with no tracks if folder is not accessible
        return {
          ...album,
          tracks: []
        }
      }
      
      // Directory is accessible, add to accessible set
      accessibleDirectories.add(album.folderPath)
      
      // Filter tracks to only include those with accessible files and exclude macOS metadata files
      const accessibleTracks = album.tracks.filter(track => {
        try {
          // Skip macOS metadata files (resource forks)
          const fileName = path.basename(track.path)
          if (fileName.startsWith('._')) {
            return false
          }
          
          return fs.existsSync(track.path)
        } catch {
          return false
        }
      })
      
      return {
        ...album,
        tracks: accessibleTracks
      }
    }).filter(album => album.tracks.length > 0) // Remove albums with no accessible tracks

    // Update scan results for accessible directories
    for (const directory of accessibleDirectories) {
      if (updatedScanResults[directory]) {
        updatedScanResults[directory] = {
          ...updatedScanResults[directory],
          status: 'available'
        }
      }
    }

    // Check all scan paths and mark unavailable ones
    for (const scanPath of scanPaths) {
      if (!accessibleDirectories.has(scanPath)) {
        // Check if this path exists at all
        const pathExists = fs.existsSync(scanPath)
        if (!pathExists) {
          updatedScanResults[scanPath] = {
            albums: 0,
            files: 0,
            lastScanned: new Date().toISOString(),
            status: 'unavailable',
            reason: 'Directory not found or not accessible'
          }
        }
      }
    }

    return Promise.resolve(NextResponse.json({
      albums: filteredAlbums,
      scanPaths,
      lastScanned,
      totalFiles,
      totalAlbums: filteredAlbums.length,
      scanResults: updatedScanResults
    }))

  } catch (error) {
    console.error('Error loading albums:', error)
    return Promise.resolve(NextResponse.json(
      { error: 'Failed to load albums' },
      { status: 500 }
    ))
  }
}

// Remove a scan location from the library. This deletes the location from the
// saved scan paths/results and drops every album that lives within that
// location. Files on disk are left untouched — only the library index is edited.
export function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const location = searchParams.get('path')?.trim()

    if (!location) {
      return Promise.resolve(NextResponse.json(
        { error: 'A "path" query parameter is required' },
        { status: 400 }
      ))
    }

    const dataPath = path.join(process.cwd(), 'data', 'music-library.json')

    if (!fs.existsSync(dataPath)) {
      // Nothing persisted yet — treat as already removed.
      return Promise.resolve(NextResponse.json({ success: true, scanPaths: [], totalAlbums: 0 }))
    }

    const data = fs.readFileSync(dataPath, 'utf8')
    const libraryData = JSON.parse(data) as LibraryData

    const albums = libraryData.albums ?? []
    const scanPaths = libraryData.scanPaths ?? (libraryData.scanPath ? [libraryData.scanPath] : [])
    const scanResults = libraryData.scanResults ?? {}

    // Normalize away trailing separators so comparisons are stable.
    const normalize = (p: string): string => p.replace(/[/\\]+$/, '')
    const target = normalize(location)
    const isWithin = (p: string): boolean => {
      const n = normalize(p)
      return n === target || n.startsWith(target + path.sep)
    }

    const remainingAlbums = albums.filter(album => !(album.folderPath !== undefined && isWithin(album.folderPath)))
    const remainingScanPaths = scanPaths.filter(p => !isWithin(p))

    const remainingScanResults: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(scanResults)) {
      if (!isWithin(key)) {
        remainingScanResults[key] = value
      }
    }

    const updatedLibrary: LibraryData = {
      ...libraryData,
      albums: remainingAlbums,
      scanPaths: remainingScanPaths,
      totalAlbums: remainingAlbums.length,
      totalFiles: remainingAlbums.reduce((sum, album) => sum + album.tracks.length, 0),
      scanResults: remainingScanResults,
    }

    // Drop the legacy single-path field if it referenced the removed location.
    if (updatedLibrary.scanPath && isWithin(updatedLibrary.scanPath)) {
      delete updatedLibrary.scanPath
    }

    fs.writeFileSync(dataPath, JSON.stringify(updatedLibrary, null, 2))

    return Promise.resolve(NextResponse.json({
      success: true,
      scanPaths: remainingScanPaths,
      totalAlbums: remainingAlbums.length,
    }))

  } catch (error) {
    console.error('Error removing location:', error)
    return Promise.resolve(NextResponse.json(
      { error: 'Failed to remove location' },
      { status: 500 }
    ))
  }
}