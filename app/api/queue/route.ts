import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import queueState from '../../../queue-state'
import logger from '@/utils/serverLogger'

function noStore(res: NextResponse): NextResponse {
  res.headers.set('Cache-Control', 'no-store')
  return res
}

interface Settings {
  partyMode: {
    enabled: boolean
    allowAddToQueue?: boolean
    allowRemoveFromQueue?: boolean
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
    case 'add':
      return partyMode.allowAddToQueue ?? true
    case 'remove':
      return partyMode.allowRemoveFromQueue ?? true
    case 'clear':
      return partyMode.allowRemoveFromQueue ?? true
    default:
      return true
  }
}

function getDetailedStatus(): {
  queue: unknown[]
  currentTrack: unknown
  isPlaying: boolean
  volume: number
  isMuted: boolean
  audioStatus: unknown
  progress: unknown
} {
  const queue = queueState.getQueue()
  const currentTrack = queueState.getCurrentTrack()
  const isPlaying = queueState.getIsPlaying()
  const audioStatus = queueState.audio.getStatus()
  
  // Get playback progress
  const progress = queueState.audio.getPlaybackProgress()
  const isFinished = queueState.audio.isTrackFinished()
  
  // Enhanced current track info
  let enhancedCurrentTrack = null
  if (currentTrack) {
    enhancedCurrentTrack = {
      ...currentTrack,
      progress,
      isFinished,
      estimatedDuration: (queueState.audio as { estimatedDuration?: number }).estimatedDuration ?? 0
    }
  }
  
  return {
    queue,
    currentTrack: enhancedCurrentTrack,
    isPlaying,
    volume: queueState.audio.getVolume(),
    isMuted: queueState.audio.isMuted(),
    audioStatus,
    progress
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!checkPartyModePermission('add')) {
      return NextResponse.json({ error: 'Adding to queue is restricted in party mode' }, { status: 403 })
    }

    const { path } = await request.json() as { path: string }
    
    if (!path) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 })
    }

    queueState.addToQueue(path)
    
    const finalStatus = getDetailedStatus()

    return NextResponse.json({
      success: true,
      ...finalStatus
    })
  } catch (error) {
    logger.error('Queue API Error', 'QueueAPI', error)
    return NextResponse.json({ error: 'Failed to add to queue' }, { status: 500 })
  }
}

export async function DELETE(): Promise<NextResponse> {
  try {
    if (!checkPartyModePermission('clear')) {
      return NextResponse.json({ error: 'Clearing queue is restricted in party mode' }, { status: 403 })
    }

    await queueState.clearQueue()
    
    return NextResponse.json({
      success: true,
      ...getDetailedStatus()
    })
  } catch (error) {
    logger.error('Queue API Error', 'QueueAPI', error)
    return NextResponse.json({ error: 'Failed to clear queue' }, { status: 500 })
  }
}

export function GET(): Promise<NextResponse> {
  try {
    return Promise.resolve(noStore(NextResponse.json(getDetailedStatus())))
  } catch (error) {
    logger.error('Queue GET API error', 'QueueAPI', error)
    return Promise.resolve(noStore(NextResponse.json({ error: 'Internal server error' }, { status: 500 })))
  }
} 