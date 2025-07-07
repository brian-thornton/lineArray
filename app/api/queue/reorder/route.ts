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
    case 'reorder':
      return partyMode.allowRemoveFromQueue ?? true // Using same permission as queue management
    default:
      return true
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    if (!checkPartyModePermission('reorder')) {
      return NextResponse.json({ error: 'Queue management is restricted in party mode' }, { status: 403 })
    }

    const { draggedTrackId, targetTrackId } = await request.json() as { draggedTrackId: string; targetTrackId: string }
    
    if (!draggedTrackId || !targetTrackId) {
      return NextResponse.json({ error: 'Both draggedTrackId and targetTrackId are required' }, { status: 400 })
    }

    const queue = queueState.getQueue()
    
    const draggedIndex = queue.findIndex((track: { id: string }) => track.id === draggedTrackId)
    const targetIndex = queue.findIndex((track: { id: string }) => track.id === targetTrackId)
    
    if (draggedIndex === -1 || targetIndex === -1) {
      return NextResponse.json({ error: 'One or both tracks not found in queue' }, { status: 404 })
    }
    
    if (draggedIndex === targetIndex) {
      return NextResponse.json({ error: 'Cannot reorder track to same position' }, { status: 400 })
    }
    
    // Reorder the queue
    queueState.reorderQueue(draggedIndex, targetIndex)
    
    const newQueue = queueState.getQueue()
    
    return NextResponse.json({
      success: true,
      queue: newQueue,
      message: 'Queue reordered successfully'
    })
  } catch (error) {
    logger.error('Queue Reorder API Error', 'QueueAPI', error)
    return NextResponse.json({ error: 'Failed to reorder queue' }, { status: 500 })
  }
} 