import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { Playlist, CreatePlaylistRequest, UpdatePlaylistRequest } from '@/types/music'

const playlistsPath = path.join(process.cwd(), 'data', 'playlists.json')
const musicLibraryPath = path.join(process.cwd(), 'data', 'music-library.json')

function loadSettings() {
  try {
    const settingsPath = path.join(process.cwd(), 'data', 'settings.json')
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error loading settings:', error)
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
    case 'create':
      return partyMode.allowCreatePlaylists
    case 'edit':
      return partyMode.allowEditPlaylists
    case 'delete':
      return partyMode.allowDeletePlaylists
    default:
      return true
  }
}

function loadPlaylists(): Playlist[] {
  try {
    if (fs.existsSync(playlistsPath)) {
      const data = fs.readFileSync(playlistsPath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error loading playlists:', error)
  }
  return []
}

function savePlaylists(playlists: Playlist[]): void {
  try {
    fs.writeFileSync(playlistsPath, JSON.stringify(playlists, null, 2))
  } catch (error) {
    console.error('Error saving playlists:', error)
    throw error
  }
}

function loadMusicLibrary() {
  try {
    if (fs.existsSync(musicLibraryPath)) {
      const data = fs.readFileSync(musicLibraryPath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error loading music library:', error)
  }
  return { albums: [] }
}

function findTrackByPath(trackPath: string) {
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

// GET /api/playlists - Get all playlists
export async function GET() {
  try {
    const playlists = loadPlaylists()
    return NextResponse.json(playlists)
  } catch (error) {
    console.error('Error getting playlists:', error)
    return NextResponse.json({ error: 'Failed to get playlists' }, { status: 500 })
  }
}

// POST /api/playlists - Create a new playlist
export async function POST(request: NextRequest) {
  try {
    if (!checkPartyModePermission('create')) {
      return NextResponse.json({ error: 'Creating playlists is restricted in party mode' }, { status: 403 })
    }

    const body: CreatePlaylistRequest = await request.json()
    const { name, description } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Playlist name is required' }, { status: 400 })
    }

    const playlists = loadPlaylists()
    
    // Check if playlist with same name already exists
    const existingPlaylist = playlists.find(p => p.name.toLowerCase() === name.toLowerCase())
    if (existingPlaylist) {
      return NextResponse.json({ error: 'A playlist with this name already exists' }, { status: 409 })
    }

    const newPlaylist: Playlist = {
      id: `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      description: description?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      trackCount: 0,
      tracks: []
    }

    playlists.push(newPlaylist)
    savePlaylists(playlists)

    return NextResponse.json(newPlaylist, { status: 201 })
  } catch (error) {
    console.error('Error creating playlist:', error)
    return NextResponse.json({ error: 'Failed to create playlist' }, { status: 500 })
  }
} 