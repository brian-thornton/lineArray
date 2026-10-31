'use client'

import React, { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Music, Radio } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { usePlayback } from '@/contexts/PlaybackContext'
import type { QueueResponse } from '@/types/api'
import styles from './IdleScreen.module.css'

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel'] as const

interface WakeLockSentinelLike {
  release: () => Promise<void>
}

/**
 * Kiosk helpers for the touch-screen jukebox:
 * - After a period with no touches, shows a full-screen "now playing" attract screen.
 *   The tap that dismisses it is swallowed so it can't trigger whatever is underneath.
 * - Keeps the screen awake while the idle screen feature is on.
 * - Suppresses the long-press context menu on touch screens.
 * Phones (guests using the QR link) never get the idle screen or the wake lock.
 */
export default function IdleScreen(): JSX.Element | null {
  const { settings } = useSettings()
  const playback = usePlayback()
  const pathname = usePathname()
  const [idle, setIdle] = useState(false)
  const [isPhone, setIsPhone] = useState(true)
  const [state, setState] = useState<QueueResponse | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const minutes = settings.idleScreenMinutes ?? 0
  // Admins working in Settings shouldn't be interrupted.
  const enabled = minutes > 0 && !isPhone && !pathname?.startsWith('/settings')

  useEffect(() => {
    const check = (): void => setIsPhone(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Idle timer: any interaction restarts it.
  useEffect(() => {
    if (!enabled) {
      setIdle(false)
      return
    }
    const restart = (): void => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setIdle(true), minutes * 60_000)
    }
    restart()
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, restart, { passive: true }))
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, restart))
    }
  }, [enabled, minutes])

  // Poll what's playing only while the idle screen is up.
  useEffect(() => {
    if (!idle) return
    let cancelled = false
    const load = async (): Promise<void> => {
      const s = await playback.getState()
      if (!cancelled) setState(s)
    }
    void load()
    const interval = setInterval(() => { void load() }, 2000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [idle, playback])

  // Keep the display awake. Only available on secure origins (localhost/https); fails quietly elsewhere.
  useEffect(() => {
    if (!enabled) return
    const { wakeLock } = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } })
    if (!wakeLock) return
    let sentinel: WakeLockSentinelLike | null = null
    const acquire = async (): Promise<void> => {
      if (document.visibilityState !== 'visible') return
      try {
        sentinel = await wakeLock.request('screen')
      } catch {
        // Not allowed (insecure origin, battery saver, etc.)
      }
    }
    void acquire()
    const onVisibility = (): void => { void acquire() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      sentinel?.release().catch(() => undefined)
    }
  }, [enabled])

  // Long-press on touch screens opens the browser context menu; nobody at a jukebox wants that.
  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)')
    const onContextMenu = (e: MouseEvent): void => {
      if (!coarse.matches) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      e.preventDefault()
    }
    document.addEventListener('contextmenu', onContextMenu)
    return () => document.removeEventListener('contextmenu', onContextMenu)
  }, [])

  if (!idle) return null

  const track = state?.currentTrack ?? null
  const isStream = Boolean(state?.isStream)
  const upNext = (state?.queue ?? []).slice(0, 3)
  const coverUrl = track
    ? isStream
      ? track.favicon ?? state?.station?.favicon ?? null
      : `/api/cover-for-track?path=${encodeURIComponent(track.path)}`
    : null

  const dismiss = (e: React.SyntheticEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIdle(false)
  }

  return (
    <div
      className={styles.overlay}
      role="button"
      tabIndex={0}
      aria-label="Tap to choose music"
      onClick={dismiss}
      onKeyDown={dismiss}
    >
      <div className={styles.drift}>
        {track ? (
          <div className={styles.nowPlaying}>
            <div className={styles.cover}>
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverUrl} alt="" className={styles.coverImage} />
              ) : (
                <div className={styles.coverFallback}>
                  {isStream ? <Radio className={styles.fallbackIcon} /> : <Music className={styles.fallbackIcon} />}
                </div>
              )}
            </div>
            <div className={styles.details}>
              <span className={styles.label}>{state?.isPlaying ? 'Now playing' : 'Paused'}</span>
              <h1 className={styles.title}>{isStream ? state?.station?.name ?? track.title : track.title}</h1>
              <p className={styles.subtitle}>
                {isStream
                  ? state?.nowPlaying ?? 'Internet Radio'
                  : [track.artist, track.album].filter(s => s && s !== 'Unknown' && s !== 'Unknown Artist').join(' · ')}
              </p>
              {upNext.length > 0 && (
                <div className={styles.upNext}>
                  <span className={styles.label}>Up next</span>
                  <ol className={styles.upNextList}>
                    {upNext.map(t => <li key={t.id}>{t.title}</li>)}
                  </ol>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.empty}>
            <Music className={styles.emptyIcon} />
            <h1 className={styles.brand}>{settings.jukeboxName || 'Jukebox'}</h1>
          </div>
        )}
        <p className={styles.prompt}>{track ? 'Tap anywhere to add a song' : 'Tap anywhere to pick a song'}</p>
      </div>
    </div>
  )
}
