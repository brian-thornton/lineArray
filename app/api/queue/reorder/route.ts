import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
const { getQueue, reorderQueue } = require('../../../../queue-state')

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
    case 'reorder':
      return partyMode.allowRemoveFromQueue // Using same permission as queue management
    default:
      return true
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!checkPartyModePermission('reorder')) {
      return NextResponse.json({ error: 'Queue management is restricted in party mode' }, { status: 403 })
    }

    const { draggedTrackId, targetTrackId } = await request.json()
    
    console.log('Queue reorder request:', { draggedTrackId, targetTrackId })
    
    if (!draggedTrackId || !targetTrackId) {
      return NextResponse.json({ error: 'Both draggedTrackId and targetTrackId are required' }, { status: 400 })
    }

    console.log('Queue API: Reordering tracks:', { draggedTrackId, targetTrackId })
    
    const queue = getQueue()
    console.log('Current queue:', queue.map((t: any) => ({ id: t.id, title: t.title })))
    
    const draggedIndex = queue.findIndex((track: any) => track.id === draggedTrackId)
    const targetIndex = queue.findIndex((track: any) => track.id === targetTrackId)
    
    console.log('Found indices:', { draggedIndex, targetIndex })
    
    if (draggedIndex === -1 || targetIndex === -1) {
      return NextResponse.json({ error: 'One or both tracks not found in queue' }, { status: 404 })
    }
    
    if (draggedIndex === targetIndex) {
      return NextResponse.json({ error: 'Cannot reorder track to same position' }, { status: 400 })
    }
    
    // Reorder the queue
    reorderQueue(draggedIndex, targetIndex)
    
    const newQueue = getQueue()
    console.log('Queue after reorder:', newQueue.map((t: any) => ({ id: t.id, title: t.title })))
    
    return NextResponse.json({
      success: true,
      queue: newQueue,
      message: 'Queue reordered successfully'
    })
  } catch (error) {
    console.error('Queue Reorder API Error:', error)
    return NextResponse.json({ error: 'Failed to reorder queue' }, { status: 500 })
  }
} 