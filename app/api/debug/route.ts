import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import queueState from '../../../queue-state'

export function GET(): Promise<NextResponse> {
  try {
    const debugInfo = queueState.getDebugInfo()
    const queue = queueState.getQueue()
    const currentTrack = queueState.getCurrentTrack()
    const isPlaying = queueState.getIsPlaying()
    const audioStatus = queueState.audio.getStatus()
    
    // Check if state file exists and get its contents
    const stateFilePath = path.join(process.cwd(), 'data', 'queue-state.json')
    let stateFileContents: unknown = null
    let stateFileError: string | null = null
    
    try {
      if (fs.existsSync(stateFilePath)) {
        stateFileContents = JSON.parse(fs.readFileSync(stateFilePath, 'utf-8'))
      }
    } catch (error) {
      stateFileError = error instanceof Error ? error.message : 'Unknown error'
    }
    
    return Promise.resolve(NextResponse.json({
      debugInfo,
      queue,
      currentTrack,
      isPlaying,
      audioStatus,
      stateFile: {
        path: stateFilePath,
        exists: fs.existsSync(stateFilePath),
        contents: stateFileContents,
        error: stateFileError
      },
      timestamp: new Date().toISOString()
    }))
  } catch (error) {
    console.error('Debug API error:', error)
    return Promise.resolve(NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 }))
  }
} 