import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import queueState from '@/queue-state'
import logger from '@/utils/serverLogger'
import type { RadioStation } from '@/types/audio'

interface Settings {
  partyMode: { enabled: boolean; allowPlay?: boolean }
}

function partyModeAllowsPlay(): boolean {
  try {
    const settingsPath = path.join(process.cwd(), 'data', 'settings.json')
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Settings
      if (settings.partyMode?.enabled) {
        return settings.partyMode.allowPlay ?? true
      }
    }
  } catch (error) {
    logger.error('Error loading settings', 'RadioPlay', error)
  }
  return true
}

// POST /api/radio/play — start playback of an internet-radio station
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!partyModeAllowsPlay()) {
      return NextResponse.json({ error: 'Playback is restricted in party mode' }, { status: 403 })
    }

    const { station } = await request.json() as { station: RadioStation }

    if (!station?.streamUrl || !station?.name) {
      return NextResponse.json({ error: 'station name and streamUrl are required' }, { status: 400 })
    }

    // Only allow http(s) stream URLs into VLC.
    let parsed: URL
    try {
      parsed = new URL(station.streamUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid stream URL' }, { status: 400 })
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'Stream URL must be http(s)' }, { status: 400 })
    }

    const success = await queueState.playStream(station)
    if (!success) {
      return NextResponse.json({ error: 'Failed to start station' }, { status: 500 })
    }

    const state = await queueState.getCurrentState()
    const res = NextResponse.json({ success: true, ...state })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error) {
    logger.error('Radio play error', 'RadioPlay', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
