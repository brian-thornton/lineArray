'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { QueueTrack, RadioStation } from '@/types/audio'
import type { QueueResponse, QueuePlayResponse } from '@/types/api'

// ─── Playback modes ──────────────────────────────────────────────────────────
// 'browser' — audio is streamed from /api/stream and played by this browser tab,
//             with a queue that belongs to this device only. (default)
// 'server'  — the original jukebox behaviour: the shared server-side queue is
//             played through VLC on the machine hosting the app.
// The choice is per-device (localStorage), so a kiosk can drive the speakers
// while phones listen privately.
export type PlaybackMode = 'browser' | 'server'
export type PlaybackAction = 'play' | 'pause' | 'resume' | 'stop' | 'skip' | 'seek'
export type ControlResult = { ok: true; state: QueuePlayResponse } | { ok: false; error: string }
export interface VolumeResult { volume: number; isMuted: boolean }
export interface PlaybackNotice { id: number; message: string }

export interface PlaybackApi {
  mode: PlaybackMode
  setMode: (mode: PlaybackMode) => void
  /** False when the server has VLC playback turned off (e.g. a browser-only Docker deployment). */
  serverAvailable: boolean
  /** Latest error/info message from local playback, for the UI to surface. */
  notice: PlaybackNotice | null
  getState: () => Promise<QueueResponse | null>
  addToQueue: (path: string, isAlbum?: boolean) => Promise<QueueResponse | null>
  clearQueue: () => Promise<QueueResponse | null>
  removeFromQueue: (trackId: string) => Promise<boolean>
  reorderQueue: (draggedTrackId: string, targetTrackId: string) => Promise<boolean>
  playTrackNow: (trackId: string) => Promise<boolean>
  control: (action: PlaybackAction, position?: number) => Promise<ControlResult>
  setVolume: (volume: number) => Promise<VolumeResult | null>
  toggleMute: () => Promise<VolumeResult | null>
  playStation: (station: RadioStation) => Promise<{ ok: boolean; error?: string }>
}

const MODE_KEY = 'jukebox.playbackMode'
const LOCAL_QUEUE_KEY = 'jukebox.localQueue'
const LOCAL_VOLUME_KEY = 'jukebox.localVolume'

const MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg; codecs=opus',
  webm: 'audio/webm',
  aif: 'audio/aiff',
  aiff: 'audio/aiff',
}

function readStorage(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function writeStorage(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* private mode / quota */ }
}

function makeTrack(filePath: string, isAlbum: boolean): QueueTrack {
  return {
    id: `track_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    path: filePath,
    title: filePath.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? 'Unknown',
    artist: 'Unknown',
    album: 'Unknown',
    duration: '0:00',
    isAlbum,
  }
}

function streamUrl(filePath: string, transcodeFrom?: number): string {
  const base = `/api/stream?path=${encodeURIComponent(filePath)}`
  return transcodeFrom === undefined ? base : `${base}&transcode=1&start=${transcodeFrom.toFixed(2)}`
}

// A few milliseconds of silence, used to "unlock" the audio element on the first
// user gesture so later programmatic play() calls (auto-advance, playback started
// after an await) aren't blocked by mobile autoplay policies.
function silentWavDataUri(): string {
  const samples = 800
  const buf = new DataView(new ArrayBuffer(44 + samples))
  const str = (o: number, s: string): void => { for (let i = 0; i < s.length; i++) buf.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); buf.setUint32(4, 36 + samples, true); str(8, 'WAVE'); str(12, 'fmt ')
  buf.setUint32(16, 16, true); buf.setUint16(20, 1, true); buf.setUint16(22, 1, true)
  buf.setUint32(24, 8000, true); buf.setUint32(28, 8000, true); buf.setUint16(32, 1, true); buf.setUint16(34, 8, true)
  str(36, 'data'); buf.setUint32(40, samples, true)
  for (let i = 0; i < samples; i++) buf.setUint8(44 + i, 128)
  let bin = ''
  new Uint8Array(buf.buffer).forEach(b => { bin += String.fromCharCode(b) })
  return `data:audio/wav;base64,${btoa(bin)}`
}

interface LocalState {
  queue: QueueTrack[]
  currentTrack: QueueTrack | null
  isStream: boolean
  station: RadioStation | null
  // Mirrors the server's manuallyStoppedByUser: after Stop, adding a track restarts playback.
  manuallyStopped: boolean
}

// When a file can't be decoded natively it is played through ffmpeg, which yields
// a live MP3 stream with no seekable timeline — so we track the offset we asked
// ffmpeg to start at and the real duration (via ffprobe) ourselves.
interface TranscodeState {
  active: boolean
  offset: number
  duration: number | null
  path: string | null
}

interface PersistedQueue {
  queue: QueueTrack[]
  currentTrack: QueueTrack | null
  position: number
}

const PlaybackContext = createContext<PlaybackApi | undefined>(undefined)

async function jsonOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null
  return await res.json() as T
}

export function PlaybackProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [mode, setModeState] = useState<PlaybackMode>('browser')
  const [notice, setNotice] = useState<PlaybackNotice | null>(null)
  const [serverAvailable, setServerAvailable] = useState(true)
  const modeRef = useRef<PlaybackMode>('browser')

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const st = useRef<LocalState>({ queue: [], currentTrack: null, isStream: false, station: null, manuallyStopped: false })
  const tx = useRef<TranscodeState>({ active: false, offset: 0, duration: null, path: null })
  const pendingSeek = useRef<number | null>(null)
  // Position of a queue restored from storage; its source is only loaded on resume.
  const resumeAt = useRef(0)
  const unlocked = useRef(false)

  const report = useCallback((message: string): void => {
    setNotice({ id: Date.now(), message })
  }, [])

  // ── Local engine helpers ──────────────────────────────────────────────────
  const getAudio = (): HTMLAudioElement => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = 'auto'
    }
    return audioRef.current
  }

  // True when a real track/station is loaded (not empty, not the unlock clip).
  const hasSource = (): boolean => {
    const src = getAudio().getAttribute('src')
    return src !== null && src !== '' && !src.startsWith('data:')
  }

  const currentSeconds = (): number => {
    const audio = getAudio()
    if (!hasSource()) return resumeAt.current
    return (tx.current.active ? tx.current.offset : 0) + (audio.currentTime || 0)
  }

  const persist = useCallback((): void => {
    const s = st.current
    const data: PersistedQueue = {
      queue: s.queue,
      currentTrack: s.isStream ? null : s.currentTrack,
      position: s.isStream ? 0 : currentSeconds(),
    }
    writeStorage(LOCAL_QUEUE_KEY, JSON.stringify(data))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const needsTranscode = (filePath: string): boolean => {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    const mime = MIME_BY_EXT[ext]
    return !mime || getAudio().canPlayType(mime) === ''
  }

  const setSource = (track: QueueTrack, transcode: boolean, startAt: number): void => {
    const audio = getAudio()
    pendingSeek.current = null
    resumeAt.current = 0
    if (transcode) {
      const knownDuration = tx.current.path === track.path ? tx.current.duration : null
      tx.current = { active: true, offset: startAt, duration: knownDuration, path: track.path }
      audio.src = streamUrl(track.path, startAt)
      if (knownDuration === null) {
        void fetch(`${streamUrl(track.path)}&meta=1`)
          .then(r => jsonOrNull<{ duration: number | null }>(r))
          .then(meta => {
            if (meta?.duration && tx.current.path === track.path) tx.current.duration = meta.duration
          })
          .catch(() => { /* duration stays unknown; seeking is disabled */ })
      }
    } else {
      tx.current = { active: false, offset: 0, duration: null, path: track.path }
      audio.src = streamUrl(track.path)
      if (startAt > 0) pendingSeek.current = startAt
    }
  }

  const startAudio = (): void => {
    getAudio().play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        report('Tap play to start audio on this device')
      }
      // AbortError just means a newer src replaced this one — ignore.
    })
  }

  const recordPlay = (trackPath: string): void => {
    void fetch('/api/playcounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackPath }),
    }).catch(() => { /* play counts are best-effort */ })
  }

  const updateMediaSession = (): void => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    const track = st.current.currentTrack
    if (!track) {
      navigator.mediaSession.metadata = null
      return
    }
    const artwork = st.current.isStream
      ? (track.favicon ? [{ src: track.favicon }] : [])
      : [{ src: `/api/cover-for-track?path=${encodeURIComponent(track.path)}` }]
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: st.current.isStream ? 'Internet Radio' : track.artist,
      album: track.album,
      artwork,
    })
  }

  const unloadAudio = (): void => {
    const audio = getAudio()
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    tx.current = { active: false, offset: 0, duration: null, path: null }
    pendingSeek.current = null
    resumeAt.current = 0
  }

  const playNext = (): boolean => {
    const s = st.current
    const next = s.queue.shift()
    s.isStream = false
    s.station = null
    s.manuallyStopped = false
    if (!next) {
      s.currentTrack = null
      unloadAudio()
      updateMediaSession()
      persist()
      return false
    }
    s.currentTrack = next
    setSource(next, needsTranscode(next.path), 0)
    startAudio()
    recordPlay(next.path)
    updateMediaSession()
    persist()
    return true
  }

  const localProgress = (): number => {
    const s = st.current
    if (s.isStream || !s.currentTrack) return 0
    const audio = getAudio()
    if (tx.current.active) {
      const d = tx.current.duration
      return d ? Math.min(1, currentSeconds() / d) : 0
    }
    return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration : 0
  }

  const localSnapshot = (): QueuePlayResponse => {
    const s = st.current
    const audio = getAudio()
    return {
      isPlaying: Boolean(s.currentTrack) && !audio.paused,
      currentTrack: s.currentTrack,
      queue: [...s.queue],
      progress: localProgress(),
      volume: audio.volume,
      isMuted: audio.muted || audio.volume === 0,
      isStream: s.isStream,
      station: s.station,
      nowPlaying: null,
    }
  }

  const localSeek = (position: number): boolean => {
    const s = st.current
    const audio = getAudio()
    if (!s.currentTrack || s.isStream) return false
    if (tx.current.active) {
      const d = tx.current.duration
      if (!d) return false
      const wasPlaying = !audio.paused
      setSource(s.currentTrack, true, position * d)
      if (wasPlaying) startAudio()
      return true
    }
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = position * audio.duration
      return true
    }
    return false
  }

  const localStop = (): void => {
    const s = st.current
    s.manuallyStopped = true
    s.currentTrack = null
    s.isStream = false
    s.station = null
    unloadAudio()
    updateMediaSession()
    persist()
  }

  const localControl = (action: PlaybackAction, position?: number): ControlResult => {
    const s = st.current
    const audio = getAudio()
    let success = true
    switch (action) {
      case 'play':
        success = playNext()
        break
      case 'pause':
        audio.pause()
        break
      case 'resume':
        if (s.currentTrack) {
          if (!hasSource()) setSource(s.currentTrack, needsTranscode(s.currentTrack.path), resumeAt.current)
          startAudio()
        } else {
          success = playNext()
        }
        break
      case 'stop':
        localStop()
        break
      case 'skip':
        success = playNext()
        break
      case 'seek':
        if (typeof position !== 'number' || position < 0 || position > 1) {
          return { ok: false, error: 'Invalid position value (must be between 0 and 1)' }
        }
        success = localSeek(position)
        break
    }
    return success ? { ok: true, state: localSnapshot() } : { ok: false, error: `Failed to ${action}` }
  }

  // ── Audio element wiring (once) ───────────────────────────────────────────
  useEffect(() => {
    const audio = getAudio()

    const savedVolume = parseFloat(readStorage(LOCAL_VOLUME_KEY) ?? '')
    if (Number.isFinite(savedVolume)) audio.volume = Math.max(0, Math.min(1, savedVolume))

    try {
      const saved = JSON.parse(readStorage(LOCAL_QUEUE_KEY) ?? 'null') as PersistedQueue | null
      if (saved && Array.isArray(saved.queue)) {
        st.current.queue = saved.queue
        if (saved.currentTrack) {
          // Restore where we left off, paused. The source is loaded on resume so an
          // idle page (or one in server mode) doesn't start streaming or spawn ffmpeg.
          st.current.currentTrack = saved.currentTrack
          resumeAt.current = saved.position || 0
          updateMediaSession()
        }
      }
    } catch { /* corrupt storage — start fresh */ }

    const onLoadedMetadata = (): void => {
      if (pendingSeek.current !== null && Number.isFinite(audio.duration)) {
        audio.currentTime = Math.min(pendingSeek.current, audio.duration)
      }
      pendingSeek.current = null
    }
    const onEnded = (): void => {
      if (!st.current.currentTrack || st.current.isStream) return
      playNext()
    }
    const onError = (): void => {
      const s = st.current
      const track = s.currentTrack
      const code = audio.error?.code
      if (!track || !hasSource() || code === MediaError.MEDIA_ERR_ABORTED) return
      if (s.isStream) {
        report(`Could not play station "${track.title}"`)
        localStop()
        return
      }
      if (!tx.current.active) {
        // Container recognised but codec unsupported (e.g. ALAC in .m4a) — let ffmpeg decode it.
        // A seek still waiting on metadata (e.g. a restored position) wins over currentTime.
        setSource(track, true, pendingSeek.current ?? currentSeconds())
        startAudio()
        return
      }
      report(`Could not play "${track.title}" in this browser — skipping`)
      playNext()
    }
    let lastSave = 0
    const onTimeUpdate = (): void => {
      if (Date.now() - lastSave > 5000) {
        lastSave = Date.now()
        persist()
      }
    }
    const onPause = (): void => persist()

    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('pause', onPause)

    const unlock = (): void => {
      if (unlocked.current || modeRef.current !== 'browser') return
      unlocked.current = true
      if (audio.getAttribute('src')) return
      audio.src = silentWavDataUri()
      audio.play().then(() => {
        // Drop only the clip — a restored track's resume position must survive.
        if (audio.src.startsWith('data:')) {
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
        }
      }).catch(() => { unlocked.current = false })
    }
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)

    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => { localControl('resume') })
      navigator.mediaSession.setActionHandler('pause', () => { localControl('pause') })
      navigator.mediaSession.setActionHandler('stop', () => { localControl('stop') })
      navigator.mediaSession.setActionHandler('nexttrack', () => { if (!st.current.isStream) playNext() })
    }

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('pause', onPause)
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Mode ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = readStorage(MODE_KEY)
    if (saved === 'server' || saved === 'browser') {
      modeRef.current = saved
      setModeState(saved)
    }
    void fetch('/api/playback')
      .then(r => jsonOrNull<{ serverPlayback: boolean }>(r))
      .then(caps => {
        if (caps && !caps.serverPlayback) {
          // The saved preference is kept, in case server playback is re-enabled later.
          setServerAvailable(false)
          modeRef.current = 'browser'
          setModeState('browser')
        }
      })
      .catch(() => { /* assume available */ })
  }, [])

  const setMode = useCallback((next: PlaybackMode): void => {
    modeRef.current = next
    setModeState(next)
    writeStorage(MODE_KEY, next)
    // Leaving browser mode silences this device. Entering it leaves the shared
    // server jukebox alone — other people may be listening to it.
    if (next === 'server') getAudio().pause()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Public API, dispatched by mode ────────────────────────────────────────
  const api = useMemo<PlaybackApi>(() => {
    if (mode === 'browser') {
      return {
        mode,
        setMode,
        serverAvailable,
        notice,
        getState: () => Promise.resolve(localSnapshot()),
        addToQueue: (filePath, isAlbum = false) => {
          const s = st.current
          s.queue.push(makeTrack(filePath, isAlbum))
          s.manuallyStopped = false
          // Start immediately (still inside the click that added it, which keeps
          // mobile autoplay policies happy) when nothing is loaded.
          if (!s.currentTrack) playNext()
          else persist()
          return Promise.resolve(localSnapshot())
        },
        clearQueue: () => {
          st.current.queue = []
          localStop()
          st.current.manuallyStopped = false
          return Promise.resolve(localSnapshot())
        },
        removeFromQueue: (trackId) => {
          const s = st.current
          const before = s.queue.length
          s.queue = s.queue.filter(t => t.id !== trackId)
          persist()
          return Promise.resolve(s.queue.length !== before)
        },
        reorderQueue: (draggedTrackId, targetTrackId) => {
          const q = st.current.queue
          const from = q.findIndex(t => t.id === draggedTrackId)
          const to = q.findIndex(t => t.id === targetTrackId)
          if (from === -1 || to === -1 || from === to) return Promise.resolve(false)
          const [moved] = q.splice(from, 1)
          q.splice(to, 0, moved)
          persist()
          return Promise.resolve(true)
        },
        playTrackNow: (trackId) => {
          const q = st.current.queue
          const index = q.findIndex(t => t.id === trackId)
          if (index === -1) return Promise.resolve(false)
          const [track] = q.splice(index, 1)
          q.unshift(track)
          return Promise.resolve(playNext())
        },
        control: (action, position) => Promise.resolve(localControl(action, position)),
        setVolume: (volume) => {
          const audio = getAudio()
          audio.volume = Math.max(0, Math.min(1, volume))
          audio.muted = false
          writeStorage(LOCAL_VOLUME_KEY, String(audio.volume))
          return Promise.resolve({ volume: audio.volume, isMuted: audio.volume === 0 })
        },
        toggleMute: () => {
          const audio = getAudio()
          audio.muted = !audio.muted
          return Promise.resolve({ volume: audio.volume, isMuted: audio.muted })
        },
        playStation: (station) => {
          const s = st.current
          s.currentTrack = {
            id: `stream_${Date.now()}`,
            path: station.streamUrl,
            title: station.name,
            artist: station.tags ?? 'Internet Radio',
            album: 'Internet Radio',
            duration: 'LIVE',
            kind: 'stream',
            favicon: station.favicon,
          }
          s.isStream = true
          s.station = station
          s.manuallyStopped = false
          tx.current = { active: false, offset: 0, duration: null, path: null }
          pendingSeek.current = null
          getAudio().src = station.streamUrl
          startAudio()
          updateMediaSession()
          persist()
          return Promise.resolve({ ok: true })
        },
      }
    }

    // Server mode — the shared jukebox, played through VLC on the host.
    const post = (url: string, body: unknown, method = 'POST'): Promise<Response> =>
      fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

    return {
      mode,
      setMode,
      serverAvailable,
      notice,
      getState: async () => {
        const res = await fetch('/api/queue')
        return jsonOrNull<QueueResponse>(res)
      },
      addToQueue: async (filePath, isAlbum = false) => {
        const res = await post('/api/queue', { path: filePath, isAlbum })
        const data = await jsonOrNull<QueueResponse>(res)
        return data?.success ? data : null
      },
      clearQueue: async () => {
        const res = await fetch('/api/queue', { method: 'DELETE' })
        return jsonOrNull<QueueResponse>(res)
      },
      removeFromQueue: async (trackId) => {
        const res = await fetch(`/api/queue/${trackId}`, { method: 'DELETE' })
        return res.ok
      },
      reorderQueue: async (draggedTrackId, targetTrackId) => {
        const res = await post('/api/queue/reorder', { draggedTrackId, targetTrackId }, 'PUT')
        return res.ok
      },
      playTrackNow: async (trackId) => {
        const res = await post('/api/control', { action: 'playTrack', trackId })
        return res.ok
      },
      control: async (action, position) => {
        const res = await post('/api/queue/play', { action, position })
        const data = await res.json() as QueuePlayResponse & { error?: string }
        return res.ok ? { ok: true, state: data } : { ok: false, error: data.error ?? 'Unknown error' }
      },
      setVolume: async (volume) => {
        const res = await post('/api/control', { action: 'setVolume', volume })
        const data = await jsonOrNull<{ volume?: number; isMuted?: boolean }>(res)
        if (!data) return null
        const actual = typeof data.volume === 'number' ? data.volume : volume
        return { volume: actual, isMuted: data.isMuted ?? actual === 0 }
      },
      toggleMute: async () => {
        const res = await post('/api/control', { action: 'toggleMute' })
        const data = await jsonOrNull<{ volume?: number; isMuted?: boolean }>(res)
        if (!data) return null
        return { volume: data.volume ?? 0, isMuted: data.isMuted ?? false }
      },
      playStation: async (station) => {
        const res = await post('/api/radio/play', { station })
        if (res.ok) return { ok: true }
        const err = await res.json() as { error?: string }
        return { ok: false, error: err.error }
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, notice, setMode, serverAvailable])

  return <PlaybackContext.Provider value={api}>{children}</PlaybackContext.Provider>
}

export function usePlayback(): PlaybackApi {
  const context = useContext(PlaybackContext)
  if (context === undefined) {
    throw new Error('usePlayback must be used within a PlaybackProvider')
  }
  return context
}
