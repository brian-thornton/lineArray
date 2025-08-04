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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData()
    const albumPath = formData.get('albumPath') as string
    const imageFile = formData.get('image') as File

    if (!albumPath || !imageFile) {
      return NextResponse.json(
        { error: 'Missing albumPath or image file' },
        { status: 400 }
      )
    }

    // For now, let's be more flexible with path validation
    // We'll accept any valid directory path and just ensure it exists
    let fullAlbumPath: string
    
    if (path.isAbsolute(albumPath)) {
      fullAlbumPath = path.resolve(albumPath)
    } else {
      // If it's a relative path, try to resolve it relative to the current working directory
      fullAlbumPath = path.resolve(process.cwd(), albumPath)
    }

    console.log('Debug paths:', {
      albumPath,
      fullAlbumPath,
      isAbsolute: path.isAbsolute(albumPath),
      exists: fs.existsSync(fullAlbumPath)
    })

    // Check if the directory exists
    if (!fs.existsSync(fullAlbumPath)) {
      return NextResponse.json(
        { 
          error: 'Album directory does not exist',
          debug: {
            albumPath,
            fullAlbumPath
          }
        },
        { status: 404 }
      )
    }

    // Check if it's actually a directory
    const stats = fs.statSync(fullAlbumPath)
    if (!stats.isDirectory()) {
      return NextResponse.json(
        { 
          error: 'Album path is not a directory',
          debug: {
            albumPath,
            fullAlbumPath
          }
        },
        { status: 400 }
      )
    }

    // Convert the image file to buffer
    const imageBuffer = Buffer.from(await imageFile.arrayBuffer())
    
    // Save as folder.jpg in the album directory
    const coverPath = path.join(fullAlbumPath, 'folder.jpg')
    fs.writeFileSync(coverPath, imageBuffer)

    // Update the album data in the library file to reflect the new cover path
    try {
      const libraryPath = path.join(process.cwd(), 'data', 'music-library.json')
      if (fs.existsSync(libraryPath)) {
        const libraryData = JSON.parse(fs.readFileSync(libraryPath, 'utf8')) as LibraryData
        
        // Find the album that matches this folder path and update its coverPath
        const albumIndex = libraryData.albums?.findIndex((album: Album) => album.folderPath === fullAlbumPath)
        if (albumIndex !== -1 && albumIndex !== undefined) {
          libraryData.albums[albumIndex].coverPath = coverPath
          fs.writeFileSync(libraryPath, JSON.stringify(libraryData, null, 2))
          console.log('Updated album data with new cover path:', coverPath)
        }
      }
    } catch (error) {
      console.error('Error updating album data:', error)
      // Don't fail the upload if we can't update the library data
    }

    return NextResponse.json({
      success: true,
      message: 'Cover art saved successfully',
      path: coverPath
    })

  } catch (error) {
    console.error('Error uploading cover art:', error)
    return NextResponse.json(
      { error: 'Failed to upload cover art' },
      { status: 500 }
    )
  }
} 