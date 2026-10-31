'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Radio, Star, Search, Loader2, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useSettings } from '@/contexts/SettingsContext'
import { usePlayback } from '@/contexts/PlaybackContext'
import type { RadioStation } from '@/types/audio'
import styles from './RadioBrowser.module.css'

type Tab = 'favorites' | 'browse'

// Genre chips for browsing by touch; values are Radio Browser tags ('' = most popular overall)
const GENRES: { label: string; tag: string }[] = [
  { label: 'Top', tag: '' },
  { label: 'Rock', tag: 'rock' },
  { label: 'Pop', tag: 'pop' },
  { label: 'Jazz', tag: 'jazz' },
  { label: 'Classical', tag: 'classical' },
  { label: 'Country', tag: 'country' },
  { label: 'Blues', tag: 'blues' },
  { label: 'Electronic', tag: 'electronic' },
  { label: 'Hip Hop', tag: 'hip hop' },
  { label: 'Oldies', tag: 'oldies' },
  { label: 'Chill', tag: 'chillout' },
  { label: 'News', tag: 'news' },
  { label: 'Talk', tag: 'talk' },
]

// Stations without a logo get an initials tile; the colour is derived from the name so it's stable
const TILE_HUES = [45, 15, 340, 280, 220, 190, 150, 100]

function initials(name: string): string {
  const words = name.replace(/[.,:;!?'"()[\]{}\-–—/\\|&+*#@]/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length === 0) return '♪'
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase()
}

function tileHue(name: string): number {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return TILE_HUES[hash % TILE_HUES.length]
}

function stationMeta(station: RadioStation): string {
  const tags = station.tags
    ? station.tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 2).join(' · ')
    : ''
  return [tags || 'Radio', station.bitrate ? `${station.bitrate} kbps` : null, station.country ?? null]
    .filter(Boolean)
    .join(' · ')
}

function StationLogo({ station, live, busy }: { station: RadioStation; live: boolean; busy: boolean }): JSX.Element {
  const [failed, setFailed] = useState(false)
  const showImage = station.favicon && !failed
  return (
    <div
      className={styles.logo}
      style={showImage ? undefined : { '--tile-hue': tileHue(station.name) } as React.CSSProperties}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={station.favicon} alt="" className={styles.logoImg} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className={styles.logoInitials}>{initials(station.name)}</span>
      )}
      {busy && (
        <span className={styles.logoOverlay}>
          <Loader2 className={styles.spinner} />
        </span>
      )}
      {live && !busy && (
        <span className={styles.logoOverlay} aria-hidden="true">
          <span className={styles.eq}><i /><i /><i /><i /></span>
        </span>
      )}
    </div>
  )
}

export default function RadioBrowser(): JSX.Element {
  const { showToast } = useToast()
  const { canPerformAction } = useSettings()
  const playback = usePlayback()
  const [tab, setTab] = useState<Tab>('browse')
  const [favorites, setFavorites] = useState<RadioStation[]>([])
  const [browseResults, setBrowseResults] = useState<RadioStation[]>([])
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState('')
  const [loading, setLoading] = useState(false)
  const [busyStation, setBusyStation] = useState<string | null>(null)
  const [liveStreamUrl, setLiveStreamUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Only the latest directory request may write results
  const latestRequest = useRef(0)

  const loadFavorites = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/radio/stations')
      if (res.ok) {
        const data = await res.json() as { stations: RadioStation[] }
        setFavorites(data.stations)
      }
    } catch {
      // ignore
    }
  }, [])

  const loadBrowse = useCallback(async (q: string, tag: string): Promise<void> => {
    const requestId = ++latestRequest.current
    setLoading(true)
    try {
      const params = new URLSearchParams({ q, tag })
      const res = await fetch(`/api/radio/browse?${params.toString()}`)
      if (res.ok && requestId === latestRequest.current) {
        const data = await res.json() as { stations: RadioStation[] }
        setBrowseResults(data.stations)
      }
    } catch {
      if (requestId === latestRequest.current) showToast('Could not load stations', 'error')
    } finally {
      if (requestId === latestRequest.current) setLoading(false)
    }
  }, [showToast])

  // Load favorites once on mount.
  useEffect(() => {
    void loadFavorites()
  }, [loadFavorites])

  // Browse loader: fetch immediately for genre changes and cleared searches, debounce only while
  // the user is typing. Single source of truth so we never fire two directory requests at once.
  useEffect(() => {
    if (tab !== 'browse') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim() === '') {
      void loadBrowse('', genre)
      return
    }
    debounceRef.current = setTimeout(() => { void loadBrowse(query, genre) }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, genre, tab, loadBrowse])

  // Poll which station is live so we can highlight it and offer Stop
  useEffect(() => {
    const poll = async (): Promise<void> => {
      try {
        const data = await playback.getState()
        if (data) {
          setLiveStreamUrl(data.isStream && data.currentTrack ? data.currentTrack.path : null)
          setIsPlaying(Boolean(data.isStream && data.isPlaying))
        }
      } catch {
        // ignore
      }
    }
    void poll()
    const interval = setInterval(() => { void poll() }, 3000)
    return () => clearInterval(interval)
  }, [playback])

  const isFavorited = useCallback(
    (station: RadioStation): boolean => favorites.some(f => f.streamUrl === station.streamUrl),
    [favorites]
  )

  const handlePlay = async (station: RadioStation): Promise<void> => {
    if (!canPerformAction('allowPlay')) {
      showToast('Playback is restricted in party mode', 'error', 3000)
      return
    }
    setBusyStation(station.id)
    try {
      const result = await playback.playStation(station)
      if (result.ok) {
        setLiveStreamUrl(station.streamUrl)
        setIsPlaying(true)
      } else {
        showToast(result.error ?? 'Could not start station', 'error', 3500)
      }
    } catch {
      showToast('Could not start station', 'error')
    } finally {
      setBusyStation(null)
    }
  }

  const handleStop = async (): Promise<void> => {
    try {
      await playback.control('stop')
      setLiveStreamUrl(null)
      setIsPlaying(false)
    } catch {
      // ignore
    }
  }

  const toggleFavorite = async (station: RadioStation): Promise<void> => {
    if (isFavorited(station)) {
      const existing = favorites.find(f => f.streamUrl === station.streamUrl)
      if (!existing) return
      try {
        const res = await fetch(`/api/radio/stations?id=${encodeURIComponent(existing.id)}`, { method: 'DELETE' })
        if (res.ok) {
          const data = await res.json() as { stations: RadioStation[] }
          setFavorites(data.stations)
        }
      } catch {
        showToast('Could not update favorites', 'error')
      }
    } else {
      try {
        const res = await fetch('/api/radio/stations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ station }),
        })
        if (res.ok) {
          const data = await res.json() as { stations: RadioStation[] }
          setFavorites(data.stations)
        }
      } catch {
        showToast('Could not update favorites', 'error')
      }
    }
  }

  const stations = tab === 'favorites' ? favorites : browseResults
  const genreLabel = GENRES.find(g => g.tag === genre)?.label ?? 'Top'

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>
          <Radio className={styles.titleIcon} />
          Radio
        </h1>

        <div className={styles.segmented} role="tablist" aria-label="Radio stations">
          <button
            role="tab"
            aria-selected={tab === 'browse'}
            className={`${styles.segment} ${tab === 'browse' ? styles.segmentActive : ''}`}
            onClick={() => setTab('browse')}
          >
            Browse
          </button>
          <button
            role="tab"
            aria-selected={tab === 'favorites'}
            className={`${styles.segment} ${tab === 'favorites' ? styles.segmentActive : ''}`}
            onClick={() => setTab('favorites')}
          >
            <Star className={styles.segmentIcon} />
            Favorites
            {favorites.length > 0 && <span className={styles.segmentCount}>{favorites.length}</span>}
          </button>
        </div>

        {tab === 'browse' && (
          <div className={styles.search}>
            <Search className={styles.searchIcon} aria-hidden="true" />
            <input
              type="search"
              enterKeyHint="search"
              className={styles.searchInput}
              placeholder="Find a station"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search radio stations"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            {loading ? (
              <Loader2 className={`${styles.searchTrailing} ${styles.spinner}`} />
            ) : query && (
              <button type="button" className={styles.searchClear} onClick={() => setQuery('')} aria-label="Clear station search">
                <X className={styles.searchClearIcon} />
              </button>
            )}
          </div>
        )}
      </div>

      {tab === 'browse' && (
        <div className={styles.chips} role="group" aria-label="Genres">
          {GENRES.map(g => (
            <button
              key={g.label}
              type="button"
              className={`${styles.chip} ${genre === g.tag ? styles.chipActive : ''}`}
              aria-pressed={genre === g.tag}
              onClick={() => setGenre(g.tag)}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      {stations.length === 0 ? (
        <div className={styles.empty}>
          <Radio className={styles.emptyIcon} />
          {tab === 'favorites' ? (
            <>
              <h3>No favorite stations yet</h3>
              <p>Browse stations and tap the star to keep them here.</p>
            </>
          ) : loading ? (
            <h3>Tuning in…</h3>
          ) : (
            <>
              <h3>No stations found</h3>
              <p>Try another name, or pick a genre above.</p>
            </>
          )}
        </div>
      ) : (
        <div className={`${styles.grid} ${loading ? styles.updating : ''}`} aria-label={tab === 'browse' ? `${genreLabel} stations` : 'Favorite stations'}>
          {stations.map((station) => {
            const live = liveStreamUrl === station.streamUrl && isPlaying
            const busy = busyStation === station.id
            const favorited = isFavorited(station)
            return (
              <div key={station.id} className={`${styles.card} ${live ? styles.cardLive : ''}`}>
                <button
                  type="button"
                  className={styles.cardMain}
                  onClick={() => { void (live ? handleStop() : handlePlay(station)) }}
                  disabled={busy}
                  aria-label={live ? `Stop ${station.name}` : `Play ${station.name}`}
                >
                  <StationLogo station={station} live={live} busy={busy} />
                  <span className={styles.info}>
                    <span className={styles.name} title={station.name}>{station.name}</span>
                    <span className={styles.meta}>
                      {live ? <span className={styles.onAir}>On air · tap to stop</span> : stationMeta(station)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className={`${styles.favButton} ${favorited ? styles.favOn : ''}`}
                  onClick={() => { void toggleFavorite(station) }}
                  aria-pressed={favorited}
                  aria-label={favorited ? `Remove ${station.name} from favorites` : `Add ${station.name} to favorites`}
                >
                  <Star className={styles.favIcon} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
