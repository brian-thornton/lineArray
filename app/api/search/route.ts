import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { cleanAlbumTrackTitles } from '@/utils/trackTitles'

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
  folderPath?: string
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
  coverPath?: string
  // Track results: the album (show) they belong to
  albumId?: string
  albumTitle?: string
}

const MAX_ALBUMS = 40
const MAX_TRACKS = 400

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
        const isAlbumAccessible = album.folderPath !== undefined && fs.existsSync(album.folderPath)
        
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

      // Search tracks within this album, matching on the cleaned-up song name
      const displayTitles = cleanAlbumTrackTitles(album.tracks)
      album.tracks.forEach((track, i) => {
        const { title } = displayTitles[i]
        const matches = title.toLowerCase().includes(searchTerm) ||
          track.artist.toLowerCase().includes(searchTerm) ||
          track.album.toLowerCase().includes(searchTerm)
        if (!matches) return

        // Only touch the disk for tracks that matched
        try {
          // Skip macOS metadata files (resource forks)
          if (path.basename(track.path).startsWith('._')) return
          if (!fs.existsSync(track.path)) return // Skip tracks with unavailable files
        } catch {
          return // Skip tracks with inaccessible files
        }

        results.push({
          type: 'track',
          id: track.id,
          title,
          artist: track.artist,
          album: track.album,
          path: track.path,
          albumId: album.id,
          albumTitle: album.title,
          coverPath: album.coverPath
        })
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
    const albums = results.filter(r => r.type === 'album').slice(0, MAX_ALBUMS)
    const tracks = results.filter(r => r.type === 'track').slice(0, MAX_TRACKS)
    const limitedResults = [...albums, ...tracks]

    return Promise.resolve(NextResponse.json({ results: limitedResults }))

  } catch (error) {
    console.error('Search API error:', error)
    return Promise.resolve(NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    ))
  }
} 