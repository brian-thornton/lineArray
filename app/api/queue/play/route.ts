import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import queueState from '../../../../queue-state'
import logger from '@/utils/serverLogger'

function noStore(res: NextResponse): NextResponse {
  res.headers.set('Cache-Control', 'no-store')
  return res
}

interface Settings {
  partyMode: {
    enabled: boolean
    allowPlay?: boolean
    allowStop?: boolean
    allowNext?: boolean
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
    case 'play':
    case 'pause':
    case 'resume':
    case 'seek':
      return partyMode.allowPlay ?? true
    case 'stop':
      return partyMode.allowStop ?? true
    case 'skip':
      return partyMode.allowNext ?? true
    default:
      return true
  }
}

// POST /api/queue/play - Playback controls
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { action, position } = await request.json() as { action: string; position?: number }
    
    if (!action) {
      return NextResponse.json({ error: 'No action provided' }, { status: 400 })
    }

    if (!checkPartyModePermission(action)) {
      return NextResponse.json({ error: `${action} is restricted in party mode` }, { status: 403 })
    }

    let success = false
    let error: string | null = null
    let progress: number | undefined

    switch (action) {
      case 'play':
        success = await queueState.playNextInQueue()
        break
      case 'pause':
        success = await queueState.audio.pause()
        break
      case 'resume':
        success = await queueState.audio.resume()
        break
      case 'stop':
        await queueState.stopAllPlayback()
        success = true
        break
      case 'skip':
        success = await queueState.playNextInQueue()
        break
      case 'seek':
        if (typeof position !== 'number' || position < 0 || position > 1) {
          error = 'Invalid position value (must be between 0 and 1)'
          break
        }
        success = await queueState.seekPlayback(position)
        // Return the current progress after seeking
        progress = queueState.getProgress()
        break
      default:
        error = 'Invalid action'
        break
    }

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    if (!success) {
      const state = await queueState.getCurrentState()
      return NextResponse.json({ 
        error: `Failed to ${action}`,
        state
      }, { status: 500 })
    }

    const state = await queueState.getCurrentState()
    return noStore(NextResponse.json({ 
      success: true,
      action,
      ...state,
      ...(progress !== undefined && { progress })
    }))
  } catch (error) {
    logger.error('Queue Play API error', 'QueuePlayAPI', error)
    return noStore(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
} 