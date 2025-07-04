import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
const { getQueue, removeFromQueue } = require('../../../../queue-state')

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
    case 'remove':
      return partyMode.allowRemoveFromQueue
    default:
      return true
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { trackId: string } }
) {
  try {
    if (!checkPartyModePermission('remove')) {
      return NextResponse.json({ error: 'Removing from queue is restricted in party mode' }, { status: 403 })
    }

    const { trackId } = params
    
    if (!trackId) {
      return NextResponse.json({ error: 'Track ID is required' }, { status: 400 })
    }

    console.log('Queue API: Removing track from queue:', trackId)
    
    // Find the track in the queue and remove it
    const queue = getQueue()
    const trackIndex = queue.findIndex((track: any) => track.id === trackId)
    
    if (trackIndex === -1) {
      return NextResponse.json({ error: 'Track not found in queue' }, { status: 404 })
    }
    
    removeFromQueue(trackIndex)
    
    return NextResponse.json({
      success: true,
      queue: getQueue(),
      message: 'Track removed from queue'
    })
  } catch (error) {
    console.error('Queue DELETE API Error:', error)
    return NextResponse.json({ error: 'Failed to remove track from queue' }, { status: 500 })
  }
} 