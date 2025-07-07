import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import queueState from '../../../../queue-state'
import logger from '@/utils/serverLogger'

interface Settings {
  partyMode: {
    enabled: boolean
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
    case 'remove':
      return partyMode.allowRemoveFromQueue ?? true
    default:
      return true
  }
}

export function DELETE(
  request: NextRequest,
  { params }: { params: { trackId: string } }
): Promise<NextResponse> {
  try {
    if (!checkPartyModePermission('remove')) {
      return Promise.resolve(NextResponse.json({ error: 'Removing from queue is restricted in party mode' }, { status: 403 }))
    }

    const { trackId } = params
    
    if (!trackId) {
      return Promise.resolve(NextResponse.json({ error: 'Track ID is required' }, { status: 400 }))
    }

    // console.log('Queue API: Removing track from queue:', trackId)
    
    // Find the track in the queue and remove it
    const queue = queueState.getQueue()
    const trackIndex = queue.findIndex((track: { id: string }) => track.id === trackId)
    
    if (trackIndex === -1) {
      return Promise.resolve(NextResponse.json({ error: 'Track not found in queue' }, { status: 404 }))
    }
    
    queueState.removeFromQueue(trackIndex)
    
    return Promise.resolve(NextResponse.json({
      success: true,
      queue: queueState.getQueue(),
      message: 'Track removed from queue'
    }))
  } catch (error) {
    logger.error('Queue DELETE API Error', 'QueueAPI', error)
    return Promise.resolve(NextResponse.json({ error: 'Failed to remove track from queue' }, { status: 500 }))
  }
} 