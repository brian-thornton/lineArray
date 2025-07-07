import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import queueState from '../../../queue-state'
import logger from '@/utils/serverLogger'

interface Settings {
  partyMode: {
    enabled: boolean
    allowPlay?: boolean
    allowStop?: boolean
    allowNext?: boolean
  }
}

interface ResponseData {
  volume?: number
  isMuted?: boolean
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
    case 'pause':
    case 'resume':
    case 'playTrack':
      return partyMode.allowPlay ?? true
    case 'stop':
      return partyMode.allowStop ?? true
    case 'skip':
      return partyMode.allowNext ?? true
    case 'setVolume':
    case 'toggleMute':
      return true // Volume control is always allowed
    default:
      return true
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { action, volume, trackId } = await request.json() as { action: string; volume?: number; trackId?: string }
    if (!action) {
      return NextResponse.json({ error: 'No action provided' }, { status: 400 })
    }

    if (!checkPartyModePermission(action)) {
      return NextResponse.json({ error: `${action} is restricted in party mode` }, { status: 403 })
    }

    // console.log(`Control API: ${action}`)

    let success = false
    let error: string | null = null
    const responseData: ResponseData = {}

    switch (action) {
      case 'pause':
        success = await queueState.audio.pause()
        break
      case 'resume':
        success = await queueState.audio.resume()
        // If resume did not actually start playback, try to play next in queue
        if (!queueState.audio.getStatus().isPlaying) {
          success = await queueState.playNextInQueue()
        }
        break
      case 'stop':
        success = await queueState.audio.stop()
        if (success) {
          void queueState.clearCurrentTrack()
        }
        break
      case 'skip':
        // Play next track in queue
        success = await queueState.playNextInQueue()
        break
      case 'playTrack':
        if (!trackId) {
          error = 'No trackId provided'
          break
        }
        // This would need to be implemented to play a specific track
        success = true // Placeholder
        break
      case 'setVolume':
        if (typeof volume !== 'number' || volume < 0 || volume > 1) {
          error = 'Invalid volume value'
          break
        }
        success = queueState.audio.setVolume(volume)
        responseData.volume = volume
        responseData.isMuted = volume === 0
        break
      case 'toggleMute':
        success = queueState.audio.toggleMute()
        responseData.isMuted = queueState.audio.isMuted()
        responseData.volume = queueState.audio.getVolume()
        break
      case 'checkAudioState':
        // This is a maintenance action to check and restore audio state
        void queueState.checkAudioState()
        success = true
        break
      case 'loadState':
        // This is a new action to manually restore queue state from the saved file
        void queueState.loadState()
        success = true
        break
      default:
        error = 'Invalid action'
        break
    }

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    if (!success) {
      const status = queueState.audio.getStatus()
      return NextResponse.json({ 
        error: `Failed to ${action}`,
        status
      }, { status: 500 })
    }

    const status = queueState.audio.getStatus()
    const currentSong = queueState.audio.getCurrentSong()
    const progress = queueState.audio.getPlaybackProgress()
    
    return NextResponse.json({ 
      success: true,
      action,
      status,
      currentSong,
      isPlaying: queueState.getIsPlaying(),
      progress,
      ...responseData
    })
  } catch (error) {
    logger.error('Control API error', 'ControlAPI', error)
    const status = queueState.audio.getStatus()
    return NextResponse.json({ 
      error: 'Internal server error',
      status
    }, { status: 500 })
  }
} 