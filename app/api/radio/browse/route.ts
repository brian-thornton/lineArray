import { NextRequest, NextResponse } from 'next/server'
import logger from '@/utils/serverLogger'
import type { RadioStation } from '@/types/audio'

// A small curated set so Browse always has content, even offline or if the
// Radio Browser directory is unreachable.
const CURATED: RadioStation[] = [
  { id: 'curated-soma-groove', name: 'SomaFM: Groove Salad', streamUrl: 'https://ice1.somafm.com/groovesalad-128-mp3', tags: 'ambient, downtempo', codec: 'MP3', bitrate: 128, homepage: 'https://somafm.com/groovesalad/' },
  { id: 'curated-soma-indie', name: 'SomaFM: Indie Pop Rocks', streamUrl: 'https://ice1.somafm.com/indiepop-128-mp3', tags: 'indie, pop', codec: 'MP3', bitrate: 128, homepage: 'https://somafm.com/indiepop/' },
  { id: 'curated-soma-drone', name: 'SomaFM: Drone Zone', streamUrl: 'https://ice1.somafm.com/dronezone-128-mp3', tags: 'ambient', codec: 'MP3', bitrate: 128, homepage: 'https://somafm.com/dronezone/' },
  { id: 'curated-soma-secret', name: 'SomaFM: Secret Agent', streamUrl: 'https://ice1.somafm.com/secretagent-128-mp3', tags: 'lounge, jazz', codec: 'MP3', bitrate: 128, homepage: 'https://somafm.com/secretagent/' },
  { id: 'curated-soma-bagel', name: 'SomaFM: BAGeL Radio', streamUrl: 'https://ice1.somafm.com/bagel-128-mp3', tags: 'alternative, rock', codec: 'MP3', bitrate: 128, homepage: 'https://somafm.com/bagel/' },
  { id: 'curated-soma-defcon', name: 'SomaFM: DEF CON Radio', streamUrl: 'https://ice1.somafm.com/defcon-128-mp3', tags: 'electronic', codec: 'MP3', bitrate: 128, homepage: 'https://somafm.com/defcon/' },
]

interface RadioBrowserStation {
  stationuuid: string
  name: string
  url_resolved: string
  url: string
  favicon: string
  tags: string
  bitrate: number
  countrycode: string
  codec: string
  homepage: string
}

function mapStation(s: RadioBrowserStation): RadioStation {
  return {
    id: s.stationuuid,
    name: s.name.trim(),
    streamUrl: s.url_resolved || s.url,
    favicon: s.favicon || undefined,
    tags: s.tags,
    bitrate: s.bitrate,
    country: s.countrycode,
    codec: s.codec,
    homepage: s.homepage,
  }
}

// GET /api/radio/browse?q=<search> — search the Radio Browser directory.
// Falls back to a curated list when no query is given or the directory fails.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''

  try {
    const base = 'https://de1.api.radio-browser.info/json/stations'
    const url = q
      ? `${base}/search?limit=50&hidebroken=true&order=clickcount&reverse=true&name=${encodeURIComponent(q)}`
      : `${base}/search?limit=50&hidebroken=true&order=clickcount&reverse=true`

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Jukebox2.0/1.0' },
      // Don't hang the UI on a slow directory.
      signal: AbortSignal.timeout(6000),
    })

    if (!response.ok) throw new Error(`Radio Browser responded ${response.status}`)

    const data = await response.json() as RadioBrowserStation[]
    const stations = data
      .filter(s => (s.url_resolved || s.url) && s.name)
      .map(mapStation)

    // If a search returned nothing, surface the curated list as a hint.
    const result = stations.length > 0 ? stations : (q ? [] : CURATED)
    const res = NextResponse.json({ stations: result, source: 'radio-browser' })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error) {
    logger.error('Radio Browser fetch failed, using curated list', 'RadioBrowse', error)
    const filtered = q
      ? CURATED.filter(s => s.name.toLowerCase().includes(q.toLowerCase()) || (s.tags ?? '').toLowerCase().includes(q.toLowerCase()))
      : CURATED
    const res = NextResponse.json({ stations: filtered, source: 'curated' })
    res.headers.set('Cache-Control', 'no-store')
    return res
  }
}
