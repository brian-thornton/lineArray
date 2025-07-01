import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string } }
) {
  try {
    // Decode the path parameter
    const decodedPath = decodeURIComponent(params.path)
    
    // Check if the file exists
    if (!fs.existsSync(decodedPath)) {
      return new NextResponse('Cover not found', { status: 404 })
    }

    // Read the file
    const imageBuffer = fs.readFileSync(decodedPath)
    
    // Determine content type based on file extension
    const ext = path.extname(decodedPath).toLowerCase()
    let contentType = 'image/jpeg' // default
    
    switch (ext) {
      case '.png':
        contentType = 'image/png'
        break
      case '.gif':
        contentType = 'image/gif'
        break
      case '.webp':
        contentType = 'image/webp'
        break
      case '.jpg':
      case '.jpeg':
      default:
        contentType = 'image/jpeg'
        break
    }

    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    })
  } catch (error) {
    console.error('Error serving cover image:', error)
    return new NextResponse('Error serving cover image', { status: 500 })
  }
} 