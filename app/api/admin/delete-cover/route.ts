import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { albumPath } = await request.json() as { albumPath: string }

    if (!albumPath) {
      return NextResponse.json(
        { error: 'Missing albumPath' },
        { status: 400 }
      )
    }

    // Construct the cover path
    const coverPath = path.join(albumPath, 'folder.jpg')
    
    // Check if the cover file exists
    if (!fs.existsSync(coverPath)) {
      return NextResponse.json(
        { error: 'Cover file does not exist' },
        { status: 404 }
      )
    }

    // Delete the cover file
    try {
      fs.unlinkSync(coverPath)
      console.log(`Successfully deleted cover: ${coverPath}`)
    } catch (error) {
      console.error(`Error deleting cover ${coverPath}:`, error)
      return NextResponse.json(
        { error: 'Failed to delete cover file' },
        { status: 500 }
      )
    }

    // Update the album data in the library file to remove the cover path
    try {
      const libraryPath = path.join(process.cwd(), 'data', 'music-library.json')
      if (fs.existsSync(libraryPath)) {
        const libraryData = JSON.parse(fs.readFileSync(libraryPath, 'utf8')) as { albums?: Array<{ folderPath?: string; coverPath?: string }> }
        
        const albumIndex = libraryData.albums?.findIndex((album) => album.folderPath === albumPath)
        if (albumIndex !== -1 && albumIndex !== undefined && libraryData.albums) {
          // Remove the coverPath property
          delete libraryData.albums[albumIndex].coverPath
          fs.writeFileSync(libraryPath, JSON.stringify(libraryData, null, 2))
          console.log(`Updated library data for album: ${albumPath}`)
        }
      }
    } catch (error) {
      console.error('Error updating album data:', error)
      // Don't fail the request if library update fails
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted cover for album`,
      deletedPath: coverPath
    })

  } catch (error) {
    console.error('Error deleting cover:', error)
    return NextResponse.json(
      { error: 'Failed to delete cover' },
      { status: 500 }
    )
  }
} 