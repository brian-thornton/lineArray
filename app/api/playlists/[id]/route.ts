import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { Playlist, UpdatePlaylistRequest, AddTrackToPlaylistRequest, ReorderPlaylistRequest } from '@/types/music'

const playlistsPath = path.join(process.cwd(), 'data', 'playlists.json')
const musicLibraryPath = path.join(process.cwd(), 'data', 'music-library.json')

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

// GET /api/playlists/[id] - Get a specific playlist
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const playlists = loadPlaylists()
    const playlist = playlists.find(p => p.id === params.id)
    
    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    return NextResponse.json(playlist)
  } catch (error) {
    console.error('Error getting playlist:', error)
    return NextResponse.json({ error: 'Failed to get playlist' }, { status: 500 })
  }
}

// PUT /api/playlists/[id] - Update a playlist
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: UpdatePlaylistRequest = await request.json()
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
      name: name?.trim() || playlist.name,
      description: description?.trim() || playlist.description,
      updatedAt: new Date().toISOString()
    }

    savePlaylists(playlists)
    return NextResponse.json(playlists[playlistIndex])
  } catch (error) {
    console.error('Error updating playlist:', error)
    return NextResponse.json({ error: 'Failed to update playlist' }, { status: 500 })
  }
}

// DELETE /api/playlists/[id] - Delete a playlist
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const playlists = loadPlaylists()
    const playlistIndex = playlists.findIndex(p => p.id === params.id)
    
    if (playlistIndex === -1) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    playlists.splice(playlistIndex, 1)
    savePlaylists(playlists)

    return NextResponse.json({ message: 'Playlist deleted successfully' })
  } catch (error) {
    console.error('Error deleting playlist:', error)
    return NextResponse.json({ error: 'Failed to delete playlist' }, { status: 500 })
  }
} 