import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { Playlist, CreatePlaylistRequest } from '@/types/music'
import logger from '@/utils/serverLogger'

const playlistsPath = path.join(process.cwd(), 'data', 'playlists.json')

interface Settings {
  partyMode: {
    enabled: boolean
    allowCreatePlaylists?: boolean
    allowEditPlaylists?: boolean
    allowDeletePlaylists?: boolean
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
    case 'create':
      return partyMode.allowCreatePlaylists ?? true
    case 'edit':
      return partyMode.allowEditPlaylists ?? true
    case 'delete':
      return partyMode.allowDeletePlaylists ?? true
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

// GET /api/playlists - Get all playlists
export function GET(): Promise<NextResponse> {
  try {
    const playlists = loadPlaylists()
    return Promise.resolve(NextResponse.json(playlists))
  } catch (error) {
    logger.error('Error getting playlists', 'PlaylistsAPI', error)
    return Promise.resolve(NextResponse.json({ error: 'Failed to get playlists' }, { status: 500 }))
  }
}

// POST /api/playlists - Create a new playlist
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!checkPartyModePermission('create')) {
      return NextResponse.json({ error: 'Creating playlists is restricted in party mode' }, { status: 403 })
    }

    const body = await request.json() as unknown as CreatePlaylistRequest
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
      description: description?.trim() ?? '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      trackCount: 0,
      tracks: []
    }

    playlists.push(newPlaylist)
    savePlaylists(playlists)

    return NextResponse.json(newPlaylist, { status: 201 })
  } catch (error) {
    logger.error('Error creating playlist', 'PlaylistsAPI', error)
    return NextResponse.json({ error: 'Failed to create playlist' }, { status: 500 })
  }
} 