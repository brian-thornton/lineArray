import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface Track {
  id: string
  title: string
  artist: string
  album: string
  trackNumber: number
  duration: number
  path: string
}

interface Album {
  id: string
  title: string
  artist: string
  coverPath: string
  tracks: Track[]
}

interface MusicLibrary {
  albums: Album[]
}

interface SearchResult {
  type: 'album' | 'track'
  id: string
  title: string
  artist: string
  album?: string
  path?: string
}

export function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.trim() === '') {
      return Promise.resolve(NextResponse.json({ results: [] }))
    }

    const libraryPath = path.join(process.cwd(), 'data', 'music-library.json')
    
    if (!fs.existsSync(libraryPath)) {
      return Promise.resolve(NextResponse.json({ results: [] }))
    }

    const libraryData = fs.readFileSync(libraryPath, 'utf-8')
    const library: MusicLibrary = JSON.parse(libraryData) as MusicLibrary

    const searchTerm = query.toLowerCase().trim()
    const results: SearchResult[] = []

    // Search albums
    library.albums.forEach(album => {
      // Check if album folder is still accessible
      try {
        const isAlbumAccessible = fs.existsSync(album.folderPath)
        
        if (!isAlbumAccessible) {
          return // Skip albums from unavailable directories
        }
      } catch {
        return // Skip albums from inaccessible directories
      }
      
      const albumTitle = album.title.toLowerCase()
      const albumArtist = album.artist.toLowerCase()

      if (albumTitle.includes(searchTerm) || albumArtist.includes(searchTerm)) {
        results.push({
          type: 'album',
          id: album.id,
          title: album.title,
          artist: album.artist,
          coverPath: album.coverPath
        })
      }

      // Search tracks within this album
      album.tracks.forEach(track => {
        // Check if track file is still accessible
        try {
          // Skip macOS metadata files (resource forks)
          const fileName = path.basename(track.path)
          if (fileName.startsWith('._')) {
            return // Skip macOS metadata files
          }
          
          if (!fs.existsSync(track.path)) {
            return // Skip tracks with unavailable files
          }
        } catch {
          return // Skip tracks with inaccessible files
        }
        
        const trackTitle = track.title.toLowerCase()
        const trackArtist = track.artist.toLowerCase()
        const trackAlbum = track.album.toLowerCase()

        if (trackTitle.includes(searchTerm) || 
            trackArtist.includes(searchTerm) || 
            trackAlbum.includes(searchTerm)) {
          results.push({
            type: 'track',
            id: track.id,
            title: track.title,
            artist: track.artist,
            album: track.album,
            path: track.path
          })
        }
      })
    })

    // Sort results: albums first, then tracks, both alphabetically by title
    results.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'album' ? -1 : 1
      }
      return a.title.localeCompare(b.title)
    })

    // Limit results to prevent overwhelming response
    const limitedResults = results.slice(0, 100)

    return Promise.resolve(NextResponse.json({ results: limitedResults }))

  } catch (error) {
    console.error('Search API error:', error)
    return Promise.resolve(NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    ))
  }
} 