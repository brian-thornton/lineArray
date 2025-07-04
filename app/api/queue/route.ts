import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
const { addToQueue, getQueue, getCurrentTrack, getIsPlaying, playNextInQueue, clearQueue, audio } = require('../../../queue-state')

function noStore(res: NextResponse) {
  res.headers.set('Cache-Control', 'no-store')
  return res
}

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
    case 'add':
      return partyMode.allowAddToQueue
    case 'remove':
      return partyMode.allowRemoveFromQueue
    case 'clear':
      return partyMode.allowRemoveFromQueue
    default:
      return true
  }
}

function getDetailedStatus() {
  const queue = getQueue()
  const currentTrack = getCurrentTrack()
  const isPlaying = getIsPlaying()
  const audioStatus = audio.getStatus()
  
  // Get playback progress
  const progress = audio.getPlaybackProgress()
  const isFinished = audio.isTrackFinished()
  
  // Enhanced current track info
  let enhancedCurrentTrack = null
  if (currentTrack) {
    enhancedCurrentTrack = {
      ...currentTrack,
      progress: progress,
      isFinished: isFinished,
      estimatedDuration: audio.estimatedDuration || 0
    }
  }
  
  return {
    queue,
    currentTrack: enhancedCurrentTrack,
    isPlaying,
    volume: audio.getVolume(),
    isMuted: typeof audio.isMuted === 'function' ? audio.isMuted() : (audio.isMuted || false),
    audioStatus,
    progress
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!checkPartyModePermission('add')) {
      return NextResponse.json({ error: 'Adding to queue is restricted in party mode' }, { status: 403 })
    }

    const { path } = await request.json()
    
    if (!path) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 })
    }

    console.log('Queue API: Adding track to queue:', path)
    addToQueue(path)
    
    // Debug: Check queue and current track status
    const queue = getQueue()
    const currentTrack = getCurrentTrack()
    const isPlaying = getIsPlaying()
    console.log('Queue API: After adding track - Queue length:', queue.length, 'Current track:', currentTrack, 'Is playing:', isPlaying)
    
    // If nothing is currently playing, start playback
    if (!getIsPlaying()) {
      console.log('Queue API: Starting playback with playNextInQueue')
      const playSuccess = await playNextInQueue()
      console.log('Queue API: playNextInQueue result:', playSuccess)
      
      // Add a small delay to ensure audio has started
      await new Promise(resolve => setTimeout(resolve, 200))
      console.log('Queue API: After delay - isPlaying:', getIsPlaying(), 'currentTrack:', getCurrentTrack())
      
      // Track play count when starting playback
      try {
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/playcounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackPath: path })
        })
      } catch (error) {
        console.error('Error tracking play count:', error)
      }
    }
    
    const finalStatus = getDetailedStatus()
    console.log('Queue API: Final status:', finalStatus)

    return NextResponse.json({
      success: true,
      ...finalStatus
    })
  } catch (error) {
    console.error('Queue API Error:', error)
    return NextResponse.json({ error: 'Failed to add to queue' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    if (!checkPartyModePermission('clear')) {
      return NextResponse.json({ error: 'Clearing queue is restricted in party mode' }, { status: 403 })
    }

    console.log('Queue API: Clearing queue')
    await clearQueue()
    
    return NextResponse.json({
      success: true,
      ...getDetailedStatus()
    })
  } catch (error) {
    console.error('Queue API Error:', error)
    return NextResponse.json({ error: 'Failed to clear queue' }, { status: 500 })
  }
}

export async function GET() {
  try {
    return noStore(NextResponse.json(getDetailedStatus()))
  } catch (error) {
    console.error('Queue GET API error:', error)
    return noStore(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
} 