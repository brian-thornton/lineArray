import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { Playlist, AddTrackToPlaylistRequest, ReorderPlaylistRequest, Album, Track } from '@/types/music'
import logger from '@/utils/serverLogger'

const playlistsPath = path.join(process.cwd(), 'data', 'playlists.json')
const musicLibraryPath = path.join(process.cwd(), 'data', 'music-library.json')

interface Settings {
  partyMode: {
    enabled: boolean
    allowEditPlaylists?: boolean
  }
}

function loadSettings(): Settings {
  try {
    const settingsPath = path.join(process.cwd(), 'data', 'settings.json')
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8')
      return JSON.parse(data) as Settings
    }
  } catch (error) {
    logger.error('Error loading settings', 'Settings', error)
  }
  return { partyMode: { enabled: false } }
}

function checkPartyModePermission(action: string): boolean {
  const settings = loadSettings()
  const { partyMode } = settings
  
  // If party mode is disabled, all actions are allowed
  if (!partyMode.enabled) {
    return true
  }
  
  // Check specific permissions based on action
  switch (action) {
    case 'edit':
      return partyMode.allowEditPlaylists ?? true
    default:
      return true
  }
}

function loadPlaylists(): Playlist[] {
  try {
    if (fs.existsSync(playlistsPath)) {
      const data = fs.readFileSync(playlistsPath, 'utf-8')
      return JSON.parse(data) as Playlist[]
    }
  } catch (error) {
    logger.error('Error loading playlists', 'Playlists', error)
  }
  return []
}

function savePlaylists(playlists: Playlist[]): void {
  try {
    fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2))
  } catch (error) {
    logger.error('Error saving playlists', 'Playlists', error)
    throw error
  }
}

function loadMusicLibrary(): { albums: Album[] } {
  try {
    if (fs.existsSync(musicLibraryPath)) {
      const data = fs.readFileSync(musicLibraryPath, 'utf-8')
      return JSON.parse(data) as { albums: Album[] }
    }
  } catch (error) {
    logger.error('Error loading music library', 'MusicLibrary', error)
  }
  return { albums: [] }
}

function findTrackByPath(trackPath: string): Track | null {
  const library = loadMusicLibrary()
  for (const album of library.albums) {
    for (const track of album.tracks) {
      if (track.path === trackPath) {
        return track
      }
    }
  }
  return null
}

// POST /api/playlists/[id]/tracks - Add track to playlist
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    if (!checkPartyModePermission('edit')) {
      return NextResponse.json({ error: 'Editing playlists is restricted in party mode' }, { status: 403 })
    }

    const body = await request.json() as unknown as AddTrackToPlaylistRequest
    const { trackPath, position } = body

    if (!trackPath) {
      return NextResponse.json({ error: 'Track path is required' }, { status: 400 })
    }

    const playlists = loadPlaylists()
    const playlistIndex = playlists.findIndex(p => p.id === params.id)
    
    if (playlistIndex === -1) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    const playlist = playlists[playlistIndex]
    const track = findTrackByPath(trackPath)
    
    if (!track) {
      return NextResponse.json({ error: 'Track not found in music library' }, { status: 404 })
    }

    // Check if track is already in playlist
    const existingTrack = playlist.tracks.find(pt => pt.track.path === trackPath)
    if (existingTrack) {
      return NextResponse.json({ error: 'Track is already in playlist' }, { status: 409 })
    }

    // Determine position
    const insertPosition = position ?? playlist.tracks.length

    // Create playlist track
    const playlistTrack = {
      id: `playlist_track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      trackId: track.id,
      playlistId: playlist.id,
      position: insertPosition,
      addedAt: new Date().toISOString(),
      track
    }

    // Insert track at specified position
    playlist.tracks.splice(insertPosition, 0, playlistTrack)
    
    // Update positions for tracks after the inserted track
    for (let i = insertPosition + 1; i < playlist.tracks.length; i++) {
      playlist.tracks[i].position = i
    }

    // Update playlist metadata
    playlist.trackCount = playlist.tracks.length
    playlist.updatedAt = new Date().toISOString()

    savePlaylists(playlists)
    return NextResponse.json(playlistTrack, { status: 201 })
  } catch (error) {
    logger.error('Error adding track to playlist', 'PlaylistTracksAPI', error)
    return NextResponse.json({ error: 'Failed to add track to playlist' }, { status: 500 })
  }
}

// PUT /api/playlists/[id]/tracks - Reorder tracks in playlist
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    if (!checkPartyModePermission('edit')) {
      return NextResponse.json({ error: 'Editing playlists is restricted in party mode' }, { status: 403 })
    }

    const body = await request.json() as unknown as ReorderPlaylistRequest
    const { trackIds } = body

    if (!trackIds || !Array.isArray(trackIds)) {
      return NextResponse.json({ error: 'Track IDs array is required' }, { status: 400 })
    }

    const playlists = loadPlaylists()
    const playlistIndex = playlists.findIndex(p => p.id === params.id)
    
    if (playlistIndex === -1) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    const playlist = playlists[playlistIndex]

    // Verify all track IDs exist in the playlist
    const existingTrackIds = new Set(playlist.tracks.map(pt => pt.id))
    const invalidTrackIds = trackIds.filter(id => !existingTrackIds.has(id))
    
    if (invalidTrackIds.length > 0) {
      return NextResponse.json({ error: 'Some track IDs are not valid' }, { status: 400 })
    }

    // Reorder tracks based on the provided order
    const reorderedTracks = trackIds.map((trackId, index) => {
      const playlistTrack = playlist.tracks.find(pt => pt.id === trackId)
      if (!playlistTrack) {
        throw new Error(`Track with ID ${trackId} not found in playlist`)
      }
      return {
        ...playlistTrack,
        position: index
      }
    })

    // Add any remaining tracks that weren't in the reorder list
    const reorderedTrackIds = new Set(trackIds)
    const remainingTracks = playlist.tracks
      .filter(pt => !reorderedTrackIds.has(pt.id))
      .map((pt, index) => ({
        ...pt,
        position: reorderedTracks.length + index
      }))

    playlist.tracks = [...reorderedTracks, ...remainingTracks]
    playlist.updatedAt = new Date().toISOString()

    savePlaylists(playlists)
    return NextResponse.json(playlist)
  } catch (error) {
    logger.error('Error reordering playlist tracks', 'PlaylistTracksAPI', error)
    return NextResponse.json({ error: 'Failed to reorder playlist tracks' }, { status: 500 })
  }
} 