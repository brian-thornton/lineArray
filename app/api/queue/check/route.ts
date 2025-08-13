import { NextResponse } from 'next/server'
import queueState from '../../../../queue-state'
import logger from '@/utils/serverLogger'

function noStore(res: NextResponse): NextResponse {
  res.headers.set('Cache-Control', 'no-store')
  return res
}

// POST /api/queue/check - Manually check queue and start playback if needed
export async function POST(): Promise<NextResponse> {
  try {
    logger.info('Queue check API called', 'QueueCheckAPI')
    
    // Manually trigger queue check
    queueState.checkQueueAndStartPlayback()
    
    // Get current state
    const state = await queueState.getCurrentState()
    
    return noStore(NextResponse.json({
      success: true,
      message: 'Queue check completed',
      state
    }))
  } catch (error) {
    logger.error('Queue check API error', 'QueueCheckAPI', error)
    return noStore(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

// GET /api/queue/check - Get queue status without triggering playback
export async function GET(): Promise<NextResponse> {
  try {
    const state = await queueState.getCurrentState()
    
    return noStore(NextResponse.json({
      success: true,
      state,
      message: 'Queue status retrieved'
    }))
  } catch (error) {
    logger.error('Queue check GET API error', 'QueueCheckAPI', error)
    return noStore(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
