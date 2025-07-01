import { NextRequest, NextResponse } from 'next/server'
const AudioManager = require('../../../audio-manager')
const { getIsPlaying, playNextInQueue, clearCurrentTrack } = require('../../../queue-state')

const audio = new AudioManager()

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()
    if (!action) {
      return NextResponse.json({ error: 'No action provided' }, { status: 400 })
    }

    console.log(`Control API: ${action}`)

    let success = false
    let error = null

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
    
    return NextResponse.json({ 
      success: true,
      action,
      status: status,
      currentSong: currentSong,
      isPlaying: getIsPlaying()
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