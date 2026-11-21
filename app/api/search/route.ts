import { NextRequest, NextResponse } from 'next/server'
import { Album } from '@/types/music'
import { cleanAlbumTrackTitles } from '@/utils/trackTitles'
import { getAvailableLibrary } from '@/utils/libraryStore'

export const dynamic = 'force-dynamic'

// Cleaned song names per album. Album objects are shared and stable until the library or
// its on-disk check changes, so this is computed once per album rather than per keystroke.
const displayTitleCache = new WeakMap<Album, string[]>()
function displayTitlesFor(album: Album): string[] {
  let titles = displayTitleCache.get(album)
  if (!titles) {
    titles = cleanAlbumTrackTitles(album.tracks).map(t => t.title)
    displayTitleCache.set(album, titles)
  }
  return titles
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.trim() === '') {
      return NextResponse.json({ results: [] })
    }

    // Albums whose folder is on disk, with only the tracks that are (cached; see libraryStore)
    const library = await getAvailableLibrary()

    const searchTerm = query.toLowerCase().trim()
    const results: SearchResult[] = []

    for (const album of library.albums) {
      if (album.title.toLowerCase().includes(searchTerm) || album.artist.toLowerCase().includes(searchTerm)) {
        results.push({
          type: 'album',
          id: album.id,
          title: album.title,
          artist: album.artist,
          coverPath: album.coverPath
        })
      }

      // Search tracks within this album, matching on the cleaned-up song name
      const displayTitles = displayTitlesFor(album)
      album.tracks.forEach((track, i) => {
        const title = displayTitles[i]
        const matches = title.toLowerCase().includes(searchTerm) ||
          track.artist.toLowerCase().includes(searchTerm) ||
          track.album.toLowerCase().includes(searchTerm)
        if (!matches) return

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
    }

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

    return NextResponse.json({ results: limitedResults })

  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    )
  }
} 