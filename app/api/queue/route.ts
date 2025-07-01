import { NextRequest, NextResponse } from 'next/server'
const { addToQueue, getQueue, getCurrentTrack, getIsPlaying, playNextInQueue, clearQueue } = require('../../../queue-state')

function noStore(res: NextResponse) {
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export async function POST(request: NextRequest) {
  try {
    const { path } = await request.json()
    
    if (!path) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 })
    }

    console.log('Queue API: Adding track to queue:', path)
    addToQueue(path)
    
    // If nothing is currently playing, start playback
    if (!getIsPlaying()) {
      await playNextInQueue()
    }

    return NextResponse.json({
      success: true,
      queue: getQueue(),
      currentTrack: getCurrentTrack(),
      isPlaying: getIsPlaying()
    })
  } catch (error) {
    console.error('Queue API Error:', error)
    return NextResponse.json({ error: 'Failed to add to queue' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    console.log('Queue API: Clearing queue')
    await clearQueue()
    
    return NextResponse.json({
      success: true,
      queue: getQueue(),
      currentTrack: getCurrentTrack(),
      isPlaying: getIsPlaying()
    })
  } catch (error) {
    console.error('Queue API Error:', error)
    return NextResponse.json({ error: 'Failed to clear queue' }, { status: 500 })
  }
}

export async function GET() {
  try {
    return noStore(NextResponse.json({ 
      queue: getQueue(),
      currentTrack: getCurrentTrack(),
      isPlaying: getIsPlaying()
    }))
  } catch (error) {
    console.error('Queue GET API error:', error)
    return noStore(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
} 