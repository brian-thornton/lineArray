"use client"

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Play, Pause, SkipForward, Square, X, Music } from 'lucide-react'
import Image from 'next/image'
import type { Track } from '@/types/api'
import Equalizer from './Equalizer'
import styles from './NowPlayingOverlay.module.css'

interface NowPlayingOverlayProps {
  coverUrl: string | null
  currentTrack: Track | null
  isPlaying: boolean
  progress: number
  isSeeking: boolean
  seekPreview: number | null
  queue: Track[]
  onClose: () => void
  onPlayPause: () => void
  onSkip: () => void
  onStop: () => void
  onSeekStart: () => void
  onSeekDrag: (pos: number) => void
  onSeekEnd: (pos: number) => void
  showSeekBar: boolean
  seekDisabled: boolean
}

function NowPlayingOverlay({
  coverUrl,
  currentTrack,
  isPlaying,
  progress,
  isSeeking,
  seekPreview,
  queue,
  onClose,
  onPlayPause,
  onSkip,
  onStop,
  onSeekStart,
  onSeekDrag,
  onSeekEnd,
  showSeekBar,
  seekDisabled,
}: NowPlayingOverlayProps): JSX.Element {
  // Escape key closes the overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const displayProgress = isSeeking ? (seekPreview ?? 0) : progress

  const overlay = (
    // Clicking anywhere on the overlay closes it; interactive children stop propagation
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Now Playing">
      {/* Blurred background — pointer-events:none so clicks pass through to overlay */}
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt=""
          aria-hidden="true"
          className={styles.bgImage}
        />
      )}

      {/* Close button */}
      <button className={styles.closeBtn} onClick={onClose} aria-label="Close now playing">
        <X size={28} />
      </button>

      {/* Main content — album art / track title taps close; controls/equalizer stop propagation */}
      <div className={styles.content}>
        {/* Album art — clicking it closes the overlay */}
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={currentTrack?.album ?? 'Album art'}
            width={320}
            height={320}
            className={styles.albumArt}
            unoptimized
          />
        ) : (
          <div className={styles.albumArtPlaceholder}>
            <Music size={64} />
          </div>
        )}

        {/* Track info — clicking it closes the overlay */}
        <div className={styles.trackInfo}>
          <h2 className={styles.trackTitle}>
            {currentTrack?.title ?? 'Unknown Track'}
          </h2>
          <p className={styles.trackMeta}>
            {[currentTrack?.artist, currentTrack?.album].filter(Boolean).join(' · ') || 'Unknown Artist'}
          </p>
        </div>

        {/* Equalizer / seek bar — stop propagation so seek interactions work */}
        {showSeekBar && (
          <div className={styles.equalizerWrap} onClick={(e) => e.stopPropagation()}>
            <Equalizer
              isPlaying={isPlaying}
              progress={displayProgress}
              onSeekStart={onSeekStart}
              onSeekDrag={onSeekDrag}
              onSeekEnd={onSeekEnd}
              disabled={seekDisabled}
            />
            <div className={styles.progressText}>
              {Math.round(displayProgress * 100)}%
            </div>
          </div>
        )}

        {/* Playback controls — stop propagation so button presses don't close overlay */}
        <div className={styles.controls} onClick={(e) => e.stopPropagation()}>
          <button
            className={styles.controlBtn}
            onClick={onPlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={28} /> : <Play size={28} />}
          </button>
          <button
            className={styles.controlBtn}
            onClick={onSkip}
            disabled={queue.length <= 1}
            aria-label="Skip to next track"
          >
            <SkipForward size={28} />
          </button>
          <button
            className={styles.controlBtn}
            onClick={onStop}
            aria-label="Stop playback"
          >
            <Square size={28} />
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}

export default NowPlayingOverlay
