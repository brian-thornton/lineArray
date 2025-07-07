import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { Album, Track } from '@/types/music'
import logger from '@/utils/serverLogger'

const playCountsPath = path.join(process.cwd(), 'data', 'playCounts.json')

interface PlayCounts {
  playCounts: { [trackPath: string]: { count: number; lastPlayed: string; playHistory: string[] } }
  lastUpdated: string | null
}

interface TrackInfo {
  title: string
  artist: string
  album: string
}

// Migrate old format to new format
const migratePlayCounts = (playCounts: unknown): PlayCounts => {
  if (!playCounts || typeof playCounts !== 'object' || !('playCounts' in playCounts)) {
    return {
      playCounts: {},
      lastUpdated: new Date().toISOString()
    }
  }
  
  const typedPlayCounts = playCounts as { playCounts: unknown; lastUpdated?: string }
  
  // Check if already in new format
  const [firstEntry] = Object.values(typedPlayCounts.playCounts as Record<string, unknown>);
  if (typeof firstEntry === 'object' && firstEntry !== null && 'count' in firstEntry) {
    return typedPlayCounts as PlayCounts
  }
  
  // Migrate from old format (just numbers) to new format
  const migrated: PlayCounts = {
    playCounts: {},
    lastUpdated: typedPlayCounts.lastUpdated ?? new Date().toISOString()
  }
  
  const now = new Date().toISOString()
  const entries = Object.entries(typedPlayCounts.playCounts as Record<string, unknown>)
  entries.forEach(([trackPath, count]) => {
    migrated.playCounts[trackPath] = {
      count: count as number,
      lastPlayed: now, // Use current time as last played for migrated data
      playHistory: [now] // Add current time to play history
    }
  })
  
  // Save migrated data
  savePlayCounts(migrated)
  return migrated
}

// Load play counts from file
const loadPlayCounts = (): PlayCounts => {
  try {
    if (fs.existsSync(playCountsPath)) {
      const data = fs.readFileSync(playCountsPath, 'utf-8')
      const parsed = JSON.parse(data) as unknown
      return migratePlayCounts(parsed)
    }
      } catch (error) {
      logger.error('Error loading play counts', 'PlayCounts', error)
    }
  
  return {
    playCounts: {},
    lastUpdated: null
  }
}

// Save play counts to file
const savePlayCounts = (playCounts: PlayCounts): void => {
  try {
    fs.writeFileSync(playCountsPath, JSON.stringify(playCounts, null, 2))
  } catch (error) {
    logger.error('Error saving play counts', 'PlayCounts', error)
  }
}

// Increment play count for a track
const incrementPlayCount = (trackPath: string): void => {
  const playCounts = loadPlayCounts()
  const now = new Date().toISOString()
  
  if (!playCounts.playCounts[trackPath]) {
    playCounts.playCounts[trackPath] = {
      count: 0,
      lastPlayed: now,
      playHistory: []
    }
  }
  
  playCounts.playCounts[trackPath].count++
  playCounts.playCounts[trackPath].lastPlayed = now
  playCounts.playCounts[trackPath].playHistory.push(now)
  
  // Keep only the last 100 play timestamps to avoid the file getting too large
  if (playCounts.playCounts[trackPath].playHistory.length > 100) {
    playCounts.playCounts[trackPath].playHistory = playCounts.playCounts[trackPath].playHistory.slice(-100)
  }
  
  playCounts.lastUpdated = now
  
  savePlayCounts(playCounts)
}

export async function GET(): Promise<NextResponse> {
  try {
    const playCounts = loadPlayCounts()
    
    // Get all albums to map track paths to track info
    const albumsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/albums`)
    const trackInfo: { [trackPath: string]: TrackInfo } = {}
    
    if (albumsResponse.ok) {
      const albumsData = await albumsResponse.json() as { albums: Album[] }
      albumsData.albums.forEach((album: Album) => {
        album.tracks.forEach((track: Track) => {
          // Store with both the exact path and normalized path for better matching
          trackInfo[track.path] = {
            title: track.title,
            artist: track.artist ?? album.artist ?? 'Unknown Artist',
            album: album.title
          }
          
          // Also try to match by filename in case paths are slightly different
          const filename = track.path.split('/').pop()
          if (filename) {
            trackInfo[filename] = {
              title: track.title,
              artist: track.artist ?? album.artist ?? 'Unknown Artist',
              album: album.title
            }
          }
        })
      })
    }
    
    // Convert play counts to array and sort by last played time (most recent first)
    const playCountsArray = Object.entries(playCounts.playCounts)
      .map(([trackPath, trackData]) => {
        // Try to find track info by exact path first, then by filename
        const filename = trackPath.split('/').pop()
        const info = trackInfo[trackPath] ?? (filename ? trackInfo[filename] : null) ?? {
          title: filename?.replace(/\.[^/.]+$/, '') ?? 'Unknown Track',
          artist: 'Unknown Artist',
          album: 'Unknown Album'
        }
        
        return {
          id: trackPath, // Use trackPath as ID
          path: trackPath,
          title: info.title,
          artist: info.artist,
          album: info.album,
          playCount: trackData.count,
          lastPlayed: trackData.lastPlayed,
          playHistory: trackData.playHistory
        }
      })
      .sort((a, b) => new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime()) // Sort by most recent first
      .slice(0, 100) // Top 100 most recent

    // Calculate total plays from ALL tracks, not just the limited array
    const totalPlays = Object.values(playCounts.playCounts).reduce((sum, trackData) => {
      return sum + (trackData.count || 0);
    }, 0);
    
    return NextResponse.json({
      tracks: playCountsArray, // Return as 'tracks' to match component expectation
      lastUpdated: playCounts.lastUpdated,
      totalTracks: Object.keys(playCounts.playCounts).length,
      totalPlays
    })
  } catch (error) {
    logger.error('Error getting play counts', 'PlayCountsAPI', error)
    return NextResponse.json(
      { error: 'Failed to get play counts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { trackPath } = await request.json() as { trackPath: string }
    
    if (!trackPath) {
      return NextResponse.json(
        { error: 'Track path is required' },
        { status: 400 }
      )
    }
    
    incrementPlayCount(trackPath)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error incrementing play count', 'PlayCountsAPI', error)
    return NextResponse.json(
      { error: 'Failed to increment play count' },
      { status: 500 }
    )
  }
} 