import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { Playlist } from '@/types/music'

const playlistsPath = path.join(process.cwd(), 'data', 'playlists.json')

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

// DELETE /api/playlists/[id]/tracks/[trackId] - Remove track from playlist
export function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; trackId: string } }
): Promise<NextResponse> {
  try {
    if (!checkPartyModePermission('edit')) {
      return Promise.resolve(NextResponse.json({ error: 'Editing playlists is restricted in party mode' }, { status: 403 }))
    }

    const playlists = loadPlaylists()
    const playlistIndex = playlists.findIndex(p => p.id === params.id)
    
    if (playlistIndex === -1) {
      return Promise.resolve(NextResponse.json({ error: 'Playlist not found' }, { status: 404 }))
    }

    const playlist = playlists[playlistIndex]
    const trackIndex = playlist.tracks.findIndex(pt => pt.id === params.trackId)
    
    if (trackIndex === -1) {
      return Promise.resolve(NextResponse.json({ error: 'Track not found in playlist' }, { status: 404 }))
    }

    // Remove the track
    playlist.tracks.splice(trackIndex, 1)
    
    // Update positions for remaining tracks
    for (let i = trackIndex; i < playlist.tracks.length; i++) {
      playlist.tracks[i].position = i
    }

    // Update playlist metadata
    playlist.trackCount = playlist.tracks.length
    playlist.updatedAt = new Date().toISOString()

    savePlaylists(playlists)
    return Promise.resolve(NextResponse.json({ message: 'Track removed from playlist successfully' }))
  } catch (error) {
    console.error('Error removing track from playlist:', error)
    return Promise.resolve(NextResponse.json({ error: 'Failed to remove track from playlist' }, { status: 500 }))
  }
} 