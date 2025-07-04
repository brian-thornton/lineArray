import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
const { getQueue, getCurrentTrack, getIsPlaying, getDebugInfo, audio } = require('../../../queue-state')

export async function GET(request: NextRequest) {
  try {
    const debugInfo = getDebugInfo()
    const queue = getQueue()
    const currentTrack = getCurrentTrack()
    const isPlaying = getIsPlaying()
    const audioStatus = audio.getStatus()
    
    // Check if state file exists and get its contents
    const stateFilePath = path.join(process.cwd(), 'data', 'queue-state.json')
    let stateFileContents = null
    let stateFileError = null
    
    try {
      if (fs.existsSync(stateFilePath)) {
        stateFileContents = JSON.parse(fs.readFileSync(stateFilePath, 'utf-8'))
      }
    } catch (error) {
      stateFileError = error instanceof Error ? error.message : 'Unknown error'
    }
    
    return NextResponse.json({
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
    })
  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 