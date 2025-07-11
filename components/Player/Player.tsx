"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Play, Pause, SkipForward, Square, Trash2, Volume2, VolumeX, List } from 'lucide-react'
import styles from './Player.module.css'
import MeterBridge from './MeterBridge'
import VolumeModal from '../VolumeModal'
import { useSettings } from '@/contexts/SettingsContext'
import { useSearch } from '@/contexts/SearchContext'
import { useToast } from '@/contexts/ToastContext'
import type { QueueResponse, QueuePlayResponse, Track } from '@/types/api'

interface PlayerStatus {
  isPlaying: boolean
  currentTrack: Track | null
  queue: Track[]
  volume?: number
  isMuted: boolean
  progress?: number
}

interface PlayerProps {
  setShowQueue: (open: boolean) => void
  showQueue: boolean
}

interface WindowWithPlayer extends Window {
  hasAddedTrackToQueue?: boolean
  checkPlayerStatusImmediately?: () => Promise<void>
}

function Player({ setShowQueue, showQueue }: PlayerProps): JSX.Element | null {
  const { canPerformAction, settings } = useSettings()
  const { hideKeyboard } = useSearch()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showVolumeModal, setShowVolumeModal] = useState(false)
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>({
    isPlaying: false,
    currentTrack: null,
    queue: [],
    volume: undefined,
    isMuted: false
  })
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekPreview, setSeekPreview] = useState<number | null>(null)
  const [showConfirmClear, setShowConfirmClear] = useState(false)

  // Detect mobile devices
  useEffect(() => {
    const checkMobile = (): void => {
      const isMobileDevice = window.innerWidth <= 768 || 
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      setIsMobile(isMobileDevice)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Poll for player status every 500ms for better responsiveness
  useEffect(() => {
    const pollStatus = async (): Promise<void> => {
      try {
        const response = await fetch('/api/queue')
        if (response.ok) {
          const data = await response.json() as QueueResponse
          setPlayerStatus(prev => {
            const newStatus = {
              ...prev,
              isPlaying: data.isPlaying,
              currentTrack: data.currentTrack,
              queue: data.queue ?? [],
              volume: data.volume ?? prev.volume,
              isMuted: data.isMuted ?? prev.isMuted,
              // Don't update progress during seeking to prevent jumping back
              progress: isSeeking ? prev.progress : (data.progress ?? prev.progress)
            }
            
            // Show toast when playback starts on mobile
            if (isMobile && data.isPlaying && !prev.isPlaying && data.currentTrack) {
              const trackName = data.currentTrack.title ?? 'Unknown Track'
              showToast(`Now playing: ${trackName}`, 'success', 4000)
            }
            
            if (!hasLoaded) setHasLoaded(true)
            // Clear the flag once we have proper status
            if (typeof window !== 'undefined' && (window as WindowWithPlayer).hasAddedTrackToQueue) {
              (window as WindowWithPlayer).hasAddedTrackToQueue = false
            }
            return newStatus
          })
        }
      } catch (error) {
        // Silently handle error - this is just polling
      }
    }

    // Also check audio state periodically to handle recompile scenarios
    const checkAudioState = async (): Promise<void> => {
      try {
        await fetch('/api/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'checkAudioState' }),
        })
      } catch (error) {
        // Silently fail - this is just a maintenance check
      }
    }

    void pollStatus();
    const statusInterval = setInterval(() => { void pollStatus(); }, 500); // Poll every 500ms for better responsiveness
    const audioCheckInterval = setInterval(() => { void checkAudioState(); }, 5000); // Check audio state every 5 seconds (less aggressive)
    
    return () => {
      clearInterval(statusInterval);
      clearInterval(audioCheckInterval);
    }
  }, [hasLoaded, isMobile, showToast, isSeeking])

  // Add a function to immediately check status (for use after adding tracks)
  const checkStatusImmediately = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/queue')
      if (response.ok) {
        const data = await response.json() as QueueResponse
        setPlayerStatus(prev => {
          const newStatus = {
            ...prev,
            isPlaying: data.isPlaying,
            currentTrack: data.currentTrack,
            queue: data.queue ?? [],
            volume: data.volume ?? prev.volume,
            isMuted: data.isMuted ?? prev.isMuted,
            // Don't update progress during seeking to prevent jumping back
            progress: isSeeking ? prev.progress : (data.progress ?? prev.progress)
          }
          
          // Clear the flag once we have proper status
          if (typeof window !== 'undefined' && (window as WindowWithPlayer).hasAddedTrackToQueue) {
            (window as WindowWithPlayer).hasAddedTrackToQueue = false
          }
          
          return newStatus
        })
      }
    } catch (error) {
      // Silently handle error
    }
  }, [isSeeking])

  // Expose the immediate check function to parent components
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as WindowWithPlayer).checkPlayerStatusImmediately = checkStatusImmediately
    }
  }, [checkStatusImmediately])



  const handlePlayPause = async (): Promise<void> => {
    if (!canPerformAction('allowPlay')) {
      showToast('Playback is restricted in party mode', 'error', 3000)
      return
    }

    setLoading(true)
    try {
      // Determine the correct action based on current state
      let action: string
      if (playerStatus.isPlaying) {
        action = 'pause'
      } else if (playerStatus.currentTrack) {
        // If we have a current track but not playing, resume it
        action = 'resume'
      } else if (playerStatus.queue.length > 0) {
        // If no current track but queue has tracks, start playing
        action = 'play'
      } else {
        // No tracks to play
        showToast('No tracks in queue to play', 'error', 3000)
        setLoading(false)
        return
      }

      const response = await fetch('/api/queue/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      
      if (response.ok) {
        const data = await response.json() as QueuePlayResponse
        setPlayerStatus(prev => ({ 
          ...prev, 
          isPlaying: data.isPlaying,
          currentTrack: data.currentTrack,
          progress: data.progress
        }))
        hideKeyboard()
      } else {
        // Silently handle error
      }
    } catch (error) {
      // Silently handle error
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async (): Promise<void> => {
    if (!canPerformAction('allowStop')) {
      showToast('Stop is restricted in party mode', 'error', 3000)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/queue/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      })
      
      if (response.ok) {
        const data = await response.json() as QueuePlayResponse
        setPlayerStatus(prev => ({
          ...prev,
          isPlaying: data.isPlaying,
          currentTrack: data.currentTrack,
          progress: data.progress
        }))
        hideKeyboard()
      } else {
        // Silently handle error
      }
    } catch (error) {
      // Silently handle error
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = async (): Promise<void> => {
    if (!canPerformAction('allowNext')) {
      showToast('Skip is restricted in party mode', 'error', 3000)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/queue/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip' }),
      })
      
      if (response.ok) {
        const data = await response.json() as QueuePlayResponse
        setPlayerStatus(prev => ({ 
          ...prev, 
          isPlaying: data.isPlaying,
          currentTrack: data.currentTrack,
          progress: data.progress
        }))
        hideKeyboard()
      } else {
        // Silently handle error
      }
    } catch (error) {
      // Silently handle error
    } finally {
      setLoading(false)
    }
  }

  const handleClearQueue = async (): Promise<void> => {
    if (!canPerformAction('allowRemoveFromQueue')) {
      showToast('Queue management is restricted in party mode', 'error', 3000)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
      
      if (response.ok) {
        const data = await response.json() as QueueResponse
        setPlayerStatus(prev => ({
          ...prev,
          isPlaying: data.isPlaying,
          currentTrack: data.currentTrack,
          queue: data.queue,
          volume: data.volume ?? prev.volume,
          isMuted: data.isMuted ?? prev.isMuted
        }))
        hideKeyboard()
      } else {
        // Silently handle error
      }
    } catch (error) {
      // Silently handle error
    } finally {
      setLoading(false)
    }
  }

  const handleVolumeChange = async (newVolume: number): Promise<void> => {
    try {
      const response = await fetch('/api/queue', {
        method: 'GET',
      })
      
      if (response.ok) {
        setPlayerStatus(prev => ({
          ...prev, 
          volume: newVolume, 
          isMuted: newVolume === 0 
        }))
      }
    } catch (error) {
      // Silently handle error
    }
  }

  const handleMuteToggle = async (): Promise<void> => {
    try {
      const response = await fetch('/api/queue', {
        method: 'GET',
      })
      
      if (response.ok) {
        const data = await response.json() as QueueResponse;
        setPlayerStatus(prev => ({ 
          ...prev, 
          isMuted: data.isMuted,
          volume: data.volume
        }))
      }
    } catch (error) {
      // Silently handle error
    }
  }

  const handleSeekStart = (): void => {
    setIsSeeking(true)
    setSeekPreview(null)
  }

  const handleSeekDrag = (position: number): void => {
    // Show preview during drag, but don't update actual progress
    setSeekPreview(position)
  }

  const handleSeekEnd = async (position: number): Promise<void> => {
    if (!canPerformAction('allowPlay')) {
      showToast('Playback control is restricted in party mode', 'error', 3000)
      setIsSeeking(false)
      setSeekPreview(null)
      return
    }

    // Keep seeking state and preview active during the seek operation
    // Don't clear them yet - we'll clear them after the seek completes

    try {
      const response = await fetch('/api/queue/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seek', position }),
      })
      
      if (response.ok) {
        const data = await response.json() as QueuePlayResponse
        setPlayerStatus(prev => ({ 
          ...prev, 
          progress: data.progress
        }))
        // Clear seeking state only after successful seek
        setIsSeeking(false)
        setSeekPreview(null)
      } else {
        const errorData = await response.json() as { error?: string }
        showToast(`Seek failed: ${errorData.error ?? 'Unknown error'}`, 'error', 3000)
        // Clear seeking state after failed seek
        setIsSeeking(false)
        setSeekPreview(null)
      }
    } catch (error) {
      // console.error('Seek error:', error)
      showToast('Seek failed: Network error', 'error', 3000)
      // Clear seeking state after network error
      setIsSeeking(false)
      setSeekPreview(null)
    }
  }

  const getCurrentTrackName = (): string => {
    if (!playerStatus.currentTrack) return 'No track playing'
    return playerStatus.currentTrack.title ?? 'Unknown Track'
  }

  const getTrackStatus = (): string => {
    if (!playerStatus.currentTrack) return 'Ready'
    
    if (playerStatus.isPlaying) {
      if (playerStatus.progress && playerStatus.progress > 0) {
        const percent = Math.round(playerStatus.progress * 100)
        return `Playing (${percent}%)`
      }
      return 'Playing'
    }
    
    return 'Paused'
  }

  const getTrackInfo = (): string => {
    if (!playerStatus.currentTrack) return 'Add tracks to get started'
    return playerStatus.currentTrack.album ?? 'Unknown Album'
  }

  // Only show the player when there's actually music to control or volume is available
  /* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
  const shouldShowPlayer = Boolean(
    playerStatus.isPlaying ||
    playerStatus.currentTrack ||
    playerStatus.queue.length > 0 ||
    (typeof window !== 'undefined' && (window as WindowWithPlayer).hasAddedTrackToQueue) ||
    showQueue ||
    typeof playerStatus.volume === 'number'
  )
  /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */

  if (!shouldShowPlayer) {
    // Player hidden - currentTrack, queue length, isPlaying, hasAddedTrackToQueue
    return null
  }
  
  // Player visible - currentTrack, queue length, isPlaying, hasAddedTrackToQueue

  if (!hasLoaded) return null;

  // console.log('[Player] isMobile:', isMobile)

  return (
    <>
      <div className={styles.player}>
        <MeterBridge isPlaying={playerStatus.isPlaying} />
        <div className={styles.content}>
          <div className={styles.trackInfo}>
            <div className={styles.cover}>
              <div className={styles.coverPlaceholder}>🎵</div>
            </div>
            <div className={styles.info}>
              <h3 className={styles.title}>
                {playerStatus.currentTrack
                  ? getCurrentTrackName()
                  : (typeof playerStatus.volume === 'number' ? 'Ready' : 'No track playing')}
              </h3>
              <p className={styles.artist}>
                {getTrackStatus()} •
                Queue: {playerStatus.queue.length} tracks
              </p>
              <p className={styles.album}>
                {getTrackInfo()}
              </p>
            </div>
          </div>
          
          {settings.showPlaybackPosition && playerStatus.currentTrack && (
            <div className={styles.playbackPosition}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isSeeking ? (seekPreview ?? playerStatus.progress ?? 0) : (playerStatus.progress ?? 0)}
                onChange={(e) => { handleSeekDrag(parseFloat(e.target.value)); }}
                onMouseUp={(e) => { void handleSeekEnd(parseFloat((e.target as HTMLInputElement).value)); }}
                onPointerUp={(e) => { void handleSeekEnd(parseFloat((e.target as HTMLInputElement).value)); }}
                onMouseDown={handleSeekStart}
                onPointerDown={handleSeekStart}
                className={styles.positionSlider}
                aria-label="Playback position"
                disabled={!canPerformAction('allowPlay') || !playerStatus.isPlaying}
              />
              <div className={styles.positionInfo}>
                <span className={styles.positionText}>
                  {isSeeking && seekPreview !== null 
                    ? `${Math.round(seekPreview * 100)}%`
                    : playerStatus.progress 
                      ? `${Math.round((playerStatus.progress ?? 0) * 100)}%` 
                      : '0%'
                  }
                </span>
              </div>
            </div>
          )}
          
          <div className={styles.mainControls}>
            <button
              className={styles.controlButton}
              onClick={() => { void handlePlayPause(); }}
              disabled={loading || !canPerformAction('allowPlay')}
              aria-label={playerStatus.isPlaying ? 'Pause' : 'Play'}
              title={!canPerformAction('allowPlay') ? 'Playback restricted in party mode' : undefined}
            >
              {playerStatus.isPlaying ? <Pause className={styles.controlIcon} /> : <Play className={styles.controlIcon} />}
            </button>
            {/* Hide skip button on mobile */}
            {!isMobile && (
              <button
                className={`${styles.controlButton} ${styles.skipButton}`}
                onClick={() => { void handleSkip(); }}
                disabled={loading || playerStatus.queue.length <= 1 || !canPerformAction('allowNext')}
                aria-label="Skip to next track"
                title={!canPerformAction('allowNext') ? 'Skip restricted in party mode' : undefined}
              >
                <SkipForward className={styles.controlIcon} />
              </button>
            )}
            <button
              className={styles.controlButton}
              onClick={() => { void handleStop(); }}
              disabled={loading || !canPerformAction('allowStop')}
              aria-label="Stop playback"
              title={!canPerformAction('allowStop') ? 'Stop restricted in party mode' : undefined}
            >
              <Square className={styles.controlIcon} />
            </button>
            <button
              className={`${styles.controlButton} ${showQueue ? styles.activeButton : ''}`}
              onClick={() => { setShowQueue(!showQueue); }}
              aria-label={showQueue ? 'Hide queue' : 'Show queue'}
              title={showQueue ? 'Hide queue' : `Show queue (${playerStatus.queue.length} tracks)`}
            >
              <List className={styles.controlIcon} />
            </button>
            <button
              className={`${styles.controlButton} ${styles.clearButton}`}
              onClick={() => { setShowConfirmClear(true); }}
              disabled={loading || playerStatus.queue.length === 0 || !canPerformAction('allowRemoveFromQueue')}
              aria-label="Clear queue"
              title={!canPerformAction('allowRemoveFromQueue') ? 'Queue management restricted in party mode' : 'Clear queue'}
            >
              <Trash2 className={styles.controlIcon} />
            </button>
          </div>
          
          <div className={styles.volume}>
            {isMobile ? (
              <button
                onClick={() => { setShowVolumeModal(true); }}
                className={styles.volumeButton}
                aria-label="Volume settings"
              >
                {playerStatus.isMuted ? <VolumeX className={styles.volumeIcon} /> : <Volume2 className={styles.volumeIcon} />}
              </button>
            ) : (
              <>
                <button
                  onClick={() => { void handleMuteToggle(); }}
                  className={styles.volumeButton}
                  aria-label={playerStatus.isMuted ? 'Unmute' : 'Mute'}
                >
                  {playerStatus.isMuted ? <VolumeX className={styles.volumeIcon} /> : <Volume2 className={styles.volumeIcon} />}
                </button>
                {typeof playerStatus.volume === 'number' && (
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={playerStatus.isMuted ? 0 : playerStatus.volume}
                    onChange={(e) => { void handleVolumeChange(parseFloat(e.target.value)); }}
                    className={styles.volumeBar}
                    aria-label="Volume"
                  />
                )}
              </>
            )}
          </div>
        </div>
        
        <VolumeModal
          isOpen={showVolumeModal}
          onClose={() => { setShowVolumeModal(false); }}
          volume={playerStatus.volume ?? 0}
          isMuted={playerStatus.isMuted}
          onVolumeChange={(volume) => { void handleVolumeChange(volume); }}
          onMuteToggle={() => { void handleMuteToggle(); }}
        />
      </div>
      {showConfirmClear && (
        <div className={styles.confirmModal} role="dialog" aria-modal="true" aria-labelledby="confirmClearTitle">
          <div className={styles.confirmModalContent}>
            <h3 id="confirmClearTitle" className={styles.confirmModalTitle}>Clear Queue?</h3>
            <p className={styles.confirmModalText}>Are you sure you want to remove all tracks from the queue?</p>
            <div className={styles.confirmModalActions}>
              <button
                className={styles.confirmButton}
                onClick={() => {
                  setShowConfirmClear(false)
                  void handleClearQueue()
                }}
              >
                Yes, clear queue
              </button>
              <button
                className={styles.cancelButton}
                onClick={() => setShowConfirmClear(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Player 