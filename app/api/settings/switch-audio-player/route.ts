import { NextRequest, NextResponse } from 'next/server'
import queueState from '@/queue-state'
import logger from '@/utils/serverLogger'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { playerType } = await request.json() as { playerType: 'vlc' | 'mpd' }
    
    if (!playerType || !['vlc', 'mpd'].includes(playerType)) {
      return NextResponse.json(
        { error: 'Invalid player type. Must be "vlc" or "mpd"' },
        { status: 400 }
      )
    }
    
    logger.info(`API: Switching audio player to: ${playerType}`, 'SwitchAudioPlayer')
    
    // Switch the audio player
    await queueState.switchAudioPlayer(playerType)
    
    // Reload audio player preference to ensure queue state is updated
    queueState.reloadAudioPlayerPreference()
    
    logger.info(`API: Audio player switched successfully to: ${playerType}`, 'SwitchAudioPlayer')
    
    return NextResponse.json({ 
      success: true, 
      message: `Audio player switched to ${playerType.toUpperCase()}`,
      playerType 
    })
    
  } catch (error) {
    logger.error('API: Error switching audio player', 'SwitchAudioPlayer', error)
    return NextResponse.json(
      { error: 'Failed to switch audio player' },
      { status: 500 }
    )
  }
}
