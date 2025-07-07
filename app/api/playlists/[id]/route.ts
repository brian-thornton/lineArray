import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { Playlist, UpdatePlaylistRequest } from '@/types/music'
import logger from '@/utils/serverLogger'

const playlistsPath = path.join(process.cwd(), 'data', 'playlists.json')

interface Settings {
  partyMode: {
    enabled: boolean
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

// GET /api/playlists/[id] - Get a specific playlist
export function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const playlists = loadPlaylists()
    const playlist = playlists.find(p => p.id === params.id)
    
    if (!playlist) {
      return Promise.resolve(NextResponse.json({ error: 'Playlist not found' }, { status: 404 }))
    }

    return Promise.resolve(NextResponse.json(playlist))
  } catch (error) {
    logger.error('Error getting playlist', 'PlaylistsAPI', error)
    return Promise.resolve(NextResponse.json({ error: 'Failed to get playlist' }, { status: 500 }))
  }
}

// PUT /api/playlists/[id] - Update a playlist
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    if (!checkPartyModePermission('edit')) {
      return NextResponse.json({ error: 'Editing playlists is restricted in party mode' }, { status: 403 })
    }

    const body = await request.json() as unknown as UpdatePlaylistRequest
    const { name, description } = body

    const playlists = loadPlaylists()
    const playlistIndex = playlists.findIndex(p => p.id === params.id)
    
    if (playlistIndex === -1) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    const playlist = playlists[playlistIndex]

    // Check if new name conflicts with existing playlist
    if (name && name.trim() !== playlist.name) {
      const existingPlaylist = playlists.find(p => 
        p.id !== params.id && p.name.toLowerCase() === name.toLowerCase()
      )
      if (existingPlaylist) {
        return NextResponse.json({ error: 'A playlist with this name already exists' }, { status: 409 })
      }
    }

    // Update playlist
    playlists[playlistIndex] = {
      ...playlist,
      name: name?.trim() ?? playlist.name,
      description: description?.trim() ?? playlist.description,
      updatedAt: new Date().toISOString()
    }

    savePlaylists(playlists)
    return NextResponse.json(playlists[playlistIndex])
  } catch (error) {
    logger.error('Error updating playlist', 'PlaylistsAPI', error)
    return NextResponse.json({ error: 'Failed to update playlist' }, { status: 500 })
  }
}

// DELETE /api/playlists/[id] - Delete a playlist
export function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    if (!checkPartyModePermission('delete')) {
      return Promise.resolve(NextResponse.json({ error: 'Deleting playlists is restricted in party mode' }, { status: 403 }))
    }

    const playlists = loadPlaylists()
    const playlistIndex = playlists.findIndex(p => p.id === params.id)
    
    if (playlistIndex === -1) {
      return Promise.resolve(NextResponse.json({ error: 'Playlist not found' }, { status: 404 }))
    }

    playlists.splice(playlistIndex, 1)
    savePlaylists(playlists)

    return Promise.resolve(NextResponse.json({ message: 'Playlist deleted successfully' }))
  } catch (error) {
    logger.error('Error deleting playlist', 'PlaylistsAPI', error)
    return Promise.resolve(NextResponse.json({ error: 'Failed to delete playlist' }, { status: 500 }))
  }
} 