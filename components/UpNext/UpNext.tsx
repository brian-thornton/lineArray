'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { X, Music, ChevronUp, ChevronDown, Play, Pencil, Check, Radio, ListMusic } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useTrackInfo, coverUrl } from '@/hooks/useTrackInfo'
import type { QueueTrack } from '@/types/audio'
import styles from './UpNext.module.css'

export type UpNextLayout = 'rail' | 'overlay' | 'sheet'

interface UpNextProps {
  /** rail: docked beside the page · overlay: slides over it · sheet: full screen on phones */
  layout: UpNextLayout
  open: boolean
  onClose: () => void
  /** Tells the shell whether anything is playing or queued (the rail hides itself when idle) */
  onContentChange: (hasContent: boolean) => void
}

const FRESH_MS = 2500
const SWIPE_CLOSE_PX = 90

function fileName(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.[^/.]+$/, '')
}

function Art({ src, stream }: { src: string | null; stream?: boolean }): JSX.Element {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [src])
  return (
    <span className={styles.art}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className={styles.artImg} loading="lazy" onError={() => setFailed(true)} />
      ) : stream ? <Radio className={styles.artIcon} /> : <Music className={styles.artIcon} />}
    </span>
  )
}

export default function UpNext({ layout, open, onClose, onContentChange }: UpNextProps): JSX.Element | null {
  const { canPerformAction } = useSettings()
  const playback = usePlayback()
  const [queue, setQueue] = useState<QueueTrack[]>([])
  const [current, setCurrent] = useState<QueueTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [nowPlayingText, setNowPlayingText] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [dragY, setDragY] = useState(0)
  const knownIds = useRef<Set<string> | null>(null)
  const touchStartY = useRef<number | null>(null)
  const panelRef = useRef<HTMLElement>(null)

  const info = useTrackInfo([...(current ? [current.path] : []), ...queue.map(t => t.path)])

  const load = useCallback(async (): Promise<void> => {
    try {
      const data = await playback.getState()
      if (!data) return
      const next = data.queue ?? []
      // Highlight tracks that arrived since the last poll (not on the first load)
      if (knownIds.current) {
        const added = next.filter(t => !knownIds.current?.has(t.id)).map(t => t.id)
        if (added.length > 0) {
          setFresh(prev => new Set([...Array.from(prev), ...added]))
          setTimeout(() => setFresh(prev => {
            const copy = new Set(prev)
            added.forEach(id => copy.delete(id))
            return copy
          }), FRESH_MS)
        }
      }
      knownIds.current = new Set(next.map(t => t.id))
      setQueue(next)
      setCurrent(data.currentTrack)
      setIsPlaying(data.isPlaying)
      setNowPlayingText(data.nowPlaying ?? null)
    } catch (error) {
      console.error('Error loading queue:', error)
    }
  }, [playback])

  // The rail needs to know about new music even while hidden; the others only poll while open
  const polling = layout === 'rail' || open
  useEffect(() => {
    if (!polling) return
    void load()
    const interval = setInterval(() => { void load() }, 1500)
    return () => clearInterval(interval)
  }, [polling, load])

  const hasContent = Boolean(current) || queue.length > 0
  useEffect(() => { onContentChange(hasContent) }, [hasContent, onContentChange])

  // Escape closes the floating versions; the docked rail stays put
  useEffect(() => {
    if (!open || layout === 'rail') return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, layout, onClose])

  // Phone sheet takes focus like a dialog; the rail and overlay leave the page focused
  useEffect(() => {
    if (open && layout === 'sheet') panelRef.current?.focus()
  }, [open, layout])

  const canReorder = canPerformAction('allowRemoveFromQueue')
  const canRemove = canPerformAction('allowRemoveFromQueue')
  const canSkip = canPerformAction('allowSkipInQueue')
  const canEdit = canReorder || canRemove || canSkip
  const isEditing = editing && canEdit && queue.length > 0

  const move = async (from: number, to: number): Promise<void> => {
    if (!canReorder || to < 0 || to >= queue.length) return
    const reordered = [...queue]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    setQueue(reordered)
    // reorderQueue moves the dragged track into the target's slot
    if (!await playback.reorderQueue(queue[from].id, queue[to].id)) void load()
  }

  const remove = async (track: QueueTrack): Promise<void> => {
    if (!canRemove) return
    setQueue(q => q.filter(t => t.id !== track.id))
    if (!await playback.removeFromQueue(track.id)) void load()
  }

  const playNow = async (track: QueueTrack): Promise<void> => {
    if (!canSkip) return
    if (await playback.playTrackNow(track.id)) void load()
  }

  // Swipe the phone sheet down to close it
  const onTouchStart = (e: React.TouchEvent): void => { touchStartY.current = e.touches[0].clientY }
  const onTouchMove = (e: React.TouchEvent): void => {
    if (touchStartY.current === null) return
    setDragY(Math.max(0, e.touches[0].clientY - touchStartY.current))
  }
  const onTouchEnd = (): void => {
    if (dragY > SWIPE_CLOSE_PX) onClose()
    touchStartY.current = null
    setDragY(0)
  }

  if (!open) return null

  const currentInfo = current ? info.get(current.path) : null
  const isStream = current?.kind === 'stream'
  const currentTitle = current
    ? (isStream ? current.title : currentInfo?.title ?? (current.title || fileName(current.path)))
    : ''
  const currentSubtitle = current
    ? (isStream ? (nowPlayingText ?? 'Internet radio') : currentInfo?.albumTitle ?? current.album)
    : ''
  const sheetDrag = layout === 'sheet' && dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined

  return (
    <aside
      ref={panelRef}
      className={`${styles.panel} ${styles[layout]}`}
      aria-label="Up next"
      role={layout === 'sheet' ? 'dialog' : 'complementary'}
      aria-modal={layout === 'sheet' ? true : undefined}
      tabIndex={layout === 'sheet' ? -1 : undefined}
      style={sheetDrag}
    >
      {layout === 'sheet' && (
        <div
          className={styles.grabber}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          aria-hidden="true"
        >
          <span />
        </div>
      )}

      <div className={styles.header}>
        <h2 className={styles.title}>
          Up next
          {queue.length > 0 && <span className={styles.count}>{queue.length}</span>}
        </h2>
        <div className={styles.headerActions}>
          {canEdit && queue.length > 0 && (
            isEditing ? (
              <button className={styles.doneButton} onClick={() => setEditing(false)}>
                <Check className={styles.buttonIcon} />
                Done
              </button>
            ) : (
              <button className={styles.textButton} onClick={() => setEditing(true)} aria-label="Edit queue">
                <Pencil className={styles.buttonIcon} />
                Edit
              </button>
            )
          )}
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label={layout === 'rail' ? 'Hide queue' : 'Close queue'}
            title={layout === 'rail' ? 'Hide queue' : 'Close'}
          >
            <X className={styles.closeIcon} />
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {current && (
          <section className={styles.nowPlaying} aria-label="Now playing">
            <Art src={isStream ? current.favicon ?? null : coverUrl(currentInfo?.coverPath)} stream={isStream} />
            <span className={styles.nowText}>
              <span className={styles.eyebrow}>
                {isPlaying && <span className={styles.eq} aria-hidden="true"><i /><i /><i /></span>}
                {isPlaying ? 'Now playing' : 'Paused'}
              </span>
              <span className={styles.nowTitle}>{currentTitle}</span>
              <span className={styles.nowSubtitle}>{currentSubtitle}</span>
            </span>
          </section>
        )}

        {queue.length === 0 ? (
          <div className={styles.empty}>
            <ListMusic className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>Nothing up next</p>
            <p>Tap ▶ on any song or album and it lines up here.</p>
          </div>
        ) : (
          <ol className={`${styles.list} ${isEditing ? styles.editing : ''}`}>
            {queue.map((track, index) => {
              const ti = info.get(track.path)
              const title = ti?.title ?? (track.title || fileName(track.path))
              const subtitle = ti?.albumTitle ?? (track.album && track.album !== 'Unknown' ? track.album : '')
              return (
                <li key={track.id} className={`${styles.row} ${fresh.has(track.id) ? styles.fresh : ''}`}>
                  <span className={styles.position}>{index + 1}</span>
                  {!isEditing && <Art src={track.kind === 'stream' ? track.favicon ?? null : coverUrl(ti?.coverPath)} stream={track.kind === 'stream'} />}
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{title}</span>
                    {subtitle && <span className={styles.rowSubtitle}>{subtitle}</span>}
                  </span>
                  {isEditing && (
                    <span className={styles.rowActions}>
                      {canSkip && (
                        <button className={styles.iconButton} onClick={() => { void playNow(track) }} aria-label={`Play ${title} now`} title="Play now">
                          <Play className={styles.iconGlyph} />
                        </button>
                      )}
                      {canReorder && (
                        <>
                          <button className={styles.iconButton} onClick={() => { void move(index, index - 1) }} disabled={index === 0} aria-label={`Move ${title} up`}>
                            <ChevronUp className={styles.iconGlyph} />
                          </button>
                          <button className={styles.iconButton} onClick={() => { void move(index, index + 1) }} disabled={index === queue.length - 1} aria-label={`Move ${title} down`}>
                            <ChevronDown className={styles.iconGlyph} />
                          </button>
                        </>
                      )}
                      {canRemove && (
                        <button className={`${styles.iconButton} ${styles.removeButton}`} onClick={() => { void remove(track) }} aria-label={`Remove ${title}`}>
                          <X className={styles.iconGlyph} />
                        </button>
                      )}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </aside>
  )
}
