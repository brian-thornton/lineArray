import { NextResponse } from 'next/server'
import { VLC_DISABLED } from '@/utils/vlcConfig'

export const dynamic = 'force-dynamic'

// GET /api/playback — which playback modes this server supports.
export function GET(): NextResponse {
  return NextResponse.json({ serverPlayback: !VLC_DISABLED })
}
