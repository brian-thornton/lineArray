import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
const { getIsPlaying, playNextInQueue, clearCurrentTrack, checkAudioState, loadState, audio } = require('../../../queue-state')

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
    case 'pause':
    case 'resume':
    case 'playTrack':
      return partyMode.allowPlay
    case 'stop':
      return partyMode.allowStop
    case 'skip':
      return partyMode.allowNext
    case 'setVolume':
    case 'toggleMute':
      return true // Volume control is always allowed
    default:
      return true
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, volume, trackId } = await request.json()
    if (!action) {
      return NextResponse.json({ error: 'No action provided' }, { status: 400 })
    }

    if (!checkPartyModePermission(action)) {
      return NextResponse.json({ error: `${action} is restricted in party mode` }, { status: 403 })
    }

    console.log(`Control API: ${action}`)

    let success = false
    let error = null
    let responseData: any = {}

    switch (action) {
      case 'pause':
        success = await audio.pause()
        break
      case 'resume':
        success = await audio.resume()
        break
      case 'stop':
        success = await audio.stop()
        if (success) {
          await clearCurrentTrack()
        }
        break
      case 'skip':
        // Play next track in queue
        success = await playNextInQueue()
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
        success = audio.setVolume(volume)
        responseData.volume = volume
        responseData.isMuted = volume === 0
        break
      case 'toggleMute':
        success = audio.toggleMute()
        responseData.isMuted = audio.isMuted()
        responseData.volume = audio.getVolume()
        break
      case 'checkAudioState':
        // This is a maintenance action to check and restore audio state
        await checkAudioState()
        success = true
        break
      case 'loadState':
        // This is a new action to manually restore queue state from the saved file
        await loadState()
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
      const status = audio.getStatus()
      return NextResponse.json({ 
        error: `Failed to ${action}`,
        status: status
      }, { status: 500 })
    }

    const status = audio.getStatus()
    const currentSong = audio.getCurrentSong()
    const progress = audio.getPlaybackProgress()
    
    return NextResponse.json({ 
      success: true,
      action,
      status: status,
      currentSong: currentSong,
      isPlaying: getIsPlaying(),
      progress: progress,
      ...responseData
    })
  } catch (error) {
    console.error('Control API error:', error)
    const status = audio.getStatus()
    return NextResponse.json({ 
      error: 'Internal server error',
      status: status
    }, { status: 500 })
  }
} 