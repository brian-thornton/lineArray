import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import logger from '@/utils/serverLogger'
import type { RadioStation } from '@/types/audio'

const STATIONS_FILE = path.join(process.cwd(), 'data', 'stations.json')

interface StationsFile {
  stations: RadioStation[]
}

function loadStations(): RadioStation[] {
  try {
    if (fs.existsSync(STATIONS_FILE)) {
      const data = fs.readFileSync(STATIONS_FILE, 'utf-8')
      const parsed = JSON.parse(data) as StationsFile
      return Array.isArray(parsed.stations) ? parsed.stations : []
    }
  } catch (error) {
    logger.error('Error loading stations', 'RadioStations', error)
  }
  return []
}

function saveStations(stations: RadioStation[]): void {
  const dataDir = path.dirname(STATIONS_FILE)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  fs.writeFileSync(STATIONS_FILE, JSON.stringify({ stations }, null, 2))
}

// GET /api/radio/stations — list favorited stations
export function GET(): NextResponse {
  const stations = loadStations()
  const res = NextResponse.json({ stations })
  res.headers.set('Cache-Control', 'no-store')
  return res
}

// POST /api/radio/stations — add a favorite station
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { station } = await request.json() as { station: RadioStation }

    if (!station?.streamUrl || !station?.name) {
      return NextResponse.json({ error: 'station name and streamUrl are required' }, { status: 400 })
    }

    // Only allow http(s) stream URLs.
    let parsed: URL
    try {
      parsed = new URL(station.streamUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid stream URL' }, { status: 400 })
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'Stream URL must be http(s)' }, { status: 400 })
    }

    const stations = loadStations()
    // De-dupe by stream URL.
    if (stations.some(s => s.streamUrl === station.streamUrl)) {
      return NextResponse.json({ success: true, stations, already: true })
    }

    const toSave: RadioStation = {
      id: station.id || `fav_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: station.name,
      streamUrl: station.streamUrl,
      favicon: station.favicon,
      tags: station.tags,
      bitrate: station.bitrate,
      country: station.country,
      codec: station.codec,
      homepage: station.homepage,
    }
    stations.push(toSave)
    saveStations(stations)
    return NextResponse.json({ success: true, stations })
  } catch (error) {
    logger.error('Error adding station', 'RadioStations', error)
    return NextResponse.json({ error: 'Failed to add station' }, { status: 500 })
  }
}

// DELETE /api/radio/stations?id=... — remove a favorite station
export function DELETE(request: NextRequest): NextResponse {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
  }
  const stations = loadStations().filter(s => s.id !== id)
  saveStations(stations)
  return NextResponse.json({ success: true, stations })
}
