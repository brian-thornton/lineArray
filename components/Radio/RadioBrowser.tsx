'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Radio, Play, Square, Star, Search, Loader2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useSettings } from '@/contexts/SettingsContext'
import type { RadioStation } from '@/types/audio'
import type { QueueResponse } from '@/types/api'
import styles from './RadioBrowser.module.css'

type Tab = 'favorites' | 'browse'

export default function RadioBrowser(): JSX.Element {
  const { showToast } = useToast()
  const { canPerformAction } = useSettings()
  const [tab, setTab] = useState<Tab>('browse')
  const [favorites, setFavorites] = useState<RadioStation[]>([])
  const [browseResults, setBrowseResults] = useState<RadioStation[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [busyStation, setBusyStation] = useState<string | null>(null)
  const [liveStreamUrl, setLiveStreamUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const loadBrowse = useCallback(async (q: string): Promise<void> => {
    setLoading(true)
    try {
      const res = await fetch(`/api/radio/browse?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json() as { stations: RadioStation[] }
        setBrowseResults(data.stations)
      }
    } catch {
      showToast('Could not load stations', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  // Load favorites once on mount.
  useEffect(() => {
    void loadFavorites()
  }, [loadFavorites])

  // Browse loader: fetch immediately when there's no query (initial load / cleared
  // search), debounce only while the user is actively typing. Single source of truth
  // so we never fire two concurrent directory requests at once.
  useEffect(() => {
    if (tab !== 'browse') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim() === '') {
      void loadBrowse('')
      return
    }
    debounceRef.current = setTimeout(() => { void loadBrowse(query) }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, tab, loadBrowse])

  // Poll which station is live so we can highlight it and offer Stop
  useEffect(() => {
    const poll = async (): Promise<void> => {
      try {
        const res = await fetch('/api/queue')
        if (res.ok) {
          const data = await res.json() as QueueResponse
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
  }, [])

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
      const res = await fetch('/api/radio/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ station }),
      })
      if (res.ok) {
        setLiveStreamUrl(station.streamUrl)
        setIsPlaying(true)
      } else {
        const err = await res.json() as { error?: string }
        showToast(err.error ?? 'Could not start station', 'error', 3500)
      }
    } catch {
      showToast('Could not start station', 'error')
    } finally {
      setBusyStation(null)
    }
  }

  const handleStop = async (): Promise<void> => {
    try {
      await fetch('/api/queue/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      })
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Radio size={28} className={styles.titleIcon} />
          <h1 className={styles.title}>Internet Radio</h1>
        </div>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'favorites' ? styles.tabActive : ''}`}
            onClick={() => setTab('favorites')}
          >
            <Star size={16} /> Favorites
          </button>
          <button
            className={`${styles.tab} ${tab === 'browse' ? styles.tabActive : ''}`}
            onClick={() => setTab('browse')}
          >
            <Search size={16} /> Browse
          </button>
        </div>
      </div>

      {tab === 'browse' && (
        <div className={styles.searchRow}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search stations by name or genre…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search radio stations"
          />
          {loading && <Loader2 size={18} className={styles.spinner} />}
        </div>
      )}

      {stations.length === 0 ? (
        <div className={styles.empty}>
          <Radio size={48} className={styles.emptyIcon} />
          {tab === 'favorites' ? (
            <>
              <h3>No favorite stations yet</h3>
              <p>Browse stations and tap the star to save them here.</p>
            </>
          ) : loading ? (
            <h3>Searching…</h3>
          ) : (
            <>
              <h3>No stations found</h3>
              <p>Try a different search term.</p>
            </>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {stations.map((station) => {
            const live = liveStreamUrl === station.streamUrl
            const favorited = isFavorited(station)
            return (
              <div key={station.id} className={`${styles.card} ${live ? styles.cardLive : ''}`}>
                <div className={styles.logo}>
                  {station.favicon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={station.favicon}
                      alt=""
                      className={styles.logoImg}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <Radio size={28} className={styles.logoPlaceholder} />
                  )}
                </div>

                <div className={styles.info}>
                  <div className={styles.name} title={station.name}>{station.name}</div>
                  <div className={styles.meta}>
                    {live && <span className={styles.liveTag}>● LIVE</span>}
                    {station.tags ? station.tags.split(',').slice(0, 2).join(' · ') : 'Radio'}
                    {station.bitrate ? ` · ${station.bitrate}kbps` : ''}
                  </div>
                </div>

                <div className={styles.actions}>
                  <button
                    className={styles.favButton}
                    onClick={() => { void toggleFavorite(station) }}
                    aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
                    title={favorited ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Star size={18} className={favorited ? styles.starFilled : styles.starEmpty} />
                  </button>

                  {live && isPlaying ? (
                    <button
                      className={`${styles.playButton} ${styles.stopButton}`}
                      onClick={() => { void handleStop() }}
                      aria-label={`Stop ${station.name}`}
                    >
                      <Square size={18} />
                    </button>
                  ) : (
                    <button
                      className={styles.playButton}
                      onClick={() => { void handlePlay(station) }}
                      disabled={busyStation === station.id}
                      aria-label={`Play ${station.name}`}
                    >
                      {busyStation === station.id ? <Loader2 size={18} className={styles.spinner} /> : <Play size={18} />}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
