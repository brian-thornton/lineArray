"use client"

import React, { useState, useEffect } from 'react'
import { Play, Pause, SkipForward, Square, Trash2, Volume2, VolumeX, List } from 'lucide-react'
import styles from './Player.module.css'
import MeterBridge from './MeterBridge'
import VolumeModal from '../VolumeModal'
import { useSettings } from '@/contexts/SettingsContext'
import { useSearch } from '@/contexts/SearchContext'
import { useToast } from '@/contexts/ToastContext'

interface Track {
  id: string
  path: string
  title: string
  artist: string
  album: string
  duration: string
  progress?: number
  isFinished?: boolean
  estimatedDuration?: number
}

interface PlayerStatus {
  isPlaying: boolean
  currentTrack: string | Track | null
  queue: Track[]
  volume?: number
  isMuted: boolean
  progress?: number
}

interface PlayerProps {
  setShowQueue: (open: boolean) => void
  showQueue: boolean
}

function Player({ setShowQueue, showQueue }: PlayerProps) {
  const { canPerformAction } = useSettings()
  const { hideKeyboard } = useSearch()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [playerActive, setPlayerActive] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showVolumeModal, setShowVolumeModal] = useState(false)
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>({
    isPlaying: false,
    currentTrack: null,
    queue: [],
    volume: undefined,
    isMuted: false
  })
  const playerActiveTimeout = React.useRef<NodeJS.Timeout | null>(null)

  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth <= 768 || 
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      setIsMobile(isMobileDevice)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Helper to keep player visible for 3 seconds after interaction
  const keepPlayerActive = () => {
    setPlayerActive(true)
    if (playerActiveTimeout.current) clearTimeout(playerActiveTimeout.current)
    playerActiveTimeout.current = setTimeout(() => setPlayerActive(false), 3000)
  }

  // Poll for player status every 500ms for better responsiveness
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const response = await fetch('/api/queue')
        if (response.ok) {
          const data = await response.json()
          setPlayerStatus(prev => {
            const newStatus = {
              ...prev,
              isPlaying: data.isPlaying,
              currentTrack: data.currentTrack,
              queue: data.queue || [],
              volume: data.volume ?? prev.volume,
              isMuted: data.isMuted ?? prev.isMuted,
              progress: data.progress ?? prev.progress
            }
            
            // Show toast when playback starts on mobile
            if (isMobile && data.isPlaying && !prev.isPlaying && data.currentTrack) {
              const trackName = typeof data.currentTrack === 'string' 
                ? data.currentTrack.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Unknown Track'
                : data.currentTrack.title || 'Unknown Track'
              showToast(`Now playing: ${trackName}`, 'success', 4000)
            }
            
            if (!hasLoaded) setHasLoaded(true)
            // Clear the flag once we have proper status
            if (typeof window !== 'undefined' && (window as any).hasAddedTrackToQueue) {
              (window as any).hasAddedTrackToQueue = false
            }
            return newStatus
          })
        }
      } catch (error) {
        console.error('Error polling player status:', error)
      }
    }

    // Also check audio state periodically to handle recompile scenarios
    const checkAudioState = async () => {
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

    pollStatus()
    const statusInterval = setInterval(pollStatus, 500) // Poll every 500ms for better responsiveness
    const audioCheckInterval = setInterval(checkAudioState, 5000) // Check audio state every 5 seconds (less aggressive)
    
    return () => {
      clearInterval(statusInterval)
      clearInterval(audioCheckInterval)
    }
  }, [])

  // Add a function to immediately check status (for use after adding tracks)
  const checkStatusImmediately = async () => {
    try {
      console.log('Performing immediate status check...')
      const response = await fetch('/api/queue')
      if (response.ok) {
        const data = await response.json()
        console.log('Immediate status check result:', data)
        setPlayerStatus(prev => {
          const newStatus = {
            ...prev,
            isPlaying: data.isPlaying,
            currentTrack: data.currentTrack,
            queue: data.queue || [],
            volume: data.volume ?? prev.volume,
            isMuted: data.isMuted ?? prev.isMuted,
            progress: data.progress ?? prev.progress
          }
          console.log('Player status updated:', newStatus)
          
          // Clear the flag once we have proper status
          if (typeof window !== 'undefined' && (window as any).hasAddedTrackToQueue) {
            (window as any).hasAddedTrackToQueue = false
          }
          
          return newStatus
        })
      }
    } catch (error) {
      console.error('Error checking status immediately:', error)
    }
  }

  // Expose the immediate check function to parent components
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).checkPlayerStatusImmediately = checkStatusImmediately
    }
  }, [])

  const handlePlayPause = async () => {
    if (!canPerformAction('allowPlay')) {
      alert('Playback is restricted in party mode')
      return
    }

    setLoading(true)
    try {
      const action = playerStatus.isPlaying ? 'pause' : 'resume'
      const response = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      
      if (response.ok) {
        const data = await response.json()
        setPlayerStatus(prev => ({ ...prev, isPlaying: data.isPlaying }))
        hideKeyboard()
      } else {
        console.error('Failed to control playback')
      }
    } catch (error) {
      console.error('Error controlling playback:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    if (!canPerformAction('allowStop')) {
      alert('Stop is restricted in party mode')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      })
      
      if (response.ok) {
        setPlayerStatus(prev => ({ ...prev, isPlaying: false, currentTrack: null }))
        hideKeyboard()
      } else {
        console.error('Failed to stop playback')
      }
    } catch (error) {
      console.error('Error stopping playback:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = async () => {
    if (!canPerformAction('allowNext')) {
      alert('Skip is restricted in party mode')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip' }),
      })
      
      if (response.ok) {
        console.log('Skipped to next track')
        hideKeyboard()
      } else {
        console.error('Failed to skip track')
      }
    } catch (error) {
      console.error('Error skipping track:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClearQueue = async () => {
    if (!canPerformAction('allowRemoveFromQueue')) {
      alert('Queue management is restricted in party mode')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
      
      if (response.ok) {
        const data = await response.json()
        setPlayerStatus(prev => ({
          ...prev,
          isPlaying: data.isPlaying,
          currentTrack: data.currentTrack,
          queue: data.queue,
          volume: data.volume ?? prev.volume,
          isMuted: data.isMuted ?? prev.isMuted
        }))
        console.log('Queue cleared')
        hideKeyboard()
      } else {
        console.error('Failed to clear queue')
      }
    } catch (error) {
      console.error('Error clearing queue:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleVolumeChange = async (newVolume: number) => {
    try {
      const response = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setVolume', volume: newVolume }),
      })
      
      if (response.ok) {
        setPlayerStatus(prev => {
          console.log('Volume change - updating player status:', { 
            oldVolume: prev.volume, 
            newVolume, 
            currentTrack: prev.currentTrack, 
            queueLength: prev.queue.length 
          })
          return { ...prev, volume: newVolume, isMuted: newVolume === 0 }
        })
      }
    } catch (error) {
      console.error('Error setting volume:', error)
    }
  }

  const handleMuteToggle = async () => {
    try {
      const response = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggleMute' }),
      })
      
      if (response.ok) {
        const data = await response.json()
        setPlayerStatus(prev => ({ 
          ...prev, 
          isMuted: data.isMuted,
          volume: data.volume ?? prev.volume
        }))
      }
    } catch (error) {
      console.error('Error toggling mute:', error)
    }
  }

  const getCurrentTrackName = (): string => {
    if (!playerStatus.currentTrack) return 'No track playing'
    
    // Handle both string paths and track objects
    if (typeof playerStatus.currentTrack === 'string') {
      // Extract filename from path
      const pathParts = playerStatus.currentTrack.split('/')
      const filename = pathParts[pathParts.length - 1]
      return filename.replace(/\.[^/.]+$/, '')
    } else {
      // Handle track object
      return playerStatus.currentTrack.title || 'Unknown Track'
    }
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
    
    if (typeof playerStatus.currentTrack === 'string') {
      return playerStatus.currentTrack
    } else {
      return playerStatus.currentTrack.album || 'Unknown Album'
    }
  }

  // Only show the player when there's actually music to control or volume is available
  const shouldShowPlayer = (
    playerStatus.currentTrack ||
    playerStatus.queue.length > 0 ||
    playerStatus.isPlaying ||
    (typeof window !== 'undefined' && (window as any).hasAddedTrackToQueue) ||
    showQueue ||
    typeof playerStatus.volume === 'number' // Show if volume is loaded
  )

  if (!shouldShowPlayer) {
    console.log('Player hidden - currentTrack:', playerStatus.currentTrack, 'queue length:', playerStatus.queue.length, 'isPlaying:', playerStatus.isPlaying, 'hasAddedTrackToQueue:', typeof window !== 'undefined' ? (window as any).hasAddedTrackToQueue : 'N/A')
    return null
  }
  
  console.log('Player visible - currentTrack:', playerStatus.currentTrack, 'queue length:', playerStatus.queue.length, 'isPlaying:', playerStatus.isPlaying, 'hasAddedTrackToQueue:', typeof window !== 'undefined' ? (window as any).hasAddedTrackToQueue : 'N/A')

  if (!hasLoaded) return null;

  return (
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
        
        <div className={styles.mainControls}>
          <button
            className={styles.controlButton}
            onClick={handlePlayPause}
            disabled={loading || !canPerformAction('allowPlay')}
            aria-label={playerStatus.isPlaying ? 'Pause' : 'Play'}
            title={!canPerformAction('allowPlay') ? 'Playback restricted in party mode' : undefined}
          >
            {playerStatus.isPlaying ? <Pause className={styles.controlIcon} /> : <Play className={styles.controlIcon} />}
          </button>
          <button
            className={styles.controlButton}
            onClick={handleSkip}
            disabled={loading || playerStatus.queue.length <= 1 || !canPerformAction('allowNext')}
            aria-label="Skip to next track"
            title={!canPerformAction('allowNext') ? 'Skip restricted in party mode' : undefined}
          >
            <SkipForward className={styles.controlIcon} />
          </button>
          <button
            className={styles.controlButton}
            onClick={handleStop}
            disabled={loading || !canPerformAction('allowStop')}
            aria-label="Stop playback"
            title={!canPerformAction('allowStop') ? 'Stop restricted in party mode' : undefined}
          >
            <Square className={styles.controlIcon} />
          </button>
          <button
            className={`${styles.controlButton} ${showQueue ? styles.activeButton : ''}`}
            onClick={() => {
              console.log('Queue button clicked, toggling showQueue')
              setShowQueue(!showQueue)
            }}
            aria-label={showQueue ? 'Hide queue' : 'Show queue'}
            title={showQueue ? 'Hide queue' : `Show queue (${playerStatus.queue.length} tracks)`}
          >
            <List className={styles.controlIcon} />
          </button>
          <button
            className={`${styles.controlButton} ${styles.clearButton}`}
            onClick={handleClearQueue}
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
              onClick={() => setShowVolumeModal(true)}
              className={styles.volumeButton}
              aria-label="Volume settings"
            >
              {playerStatus.isMuted ? <VolumeX className={styles.volumeIcon} /> : <Volume2 className={styles.volumeIcon} />}
            </button>
          ) : (
            <>
              <button
                onClick={handleMuteToggle}
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
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
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
        onClose={() => setShowVolumeModal(false)}
        volume={playerStatus.volume || 0}
        isMuted={playerStatus.isMuted}
        onVolumeChange={handleVolumeChange}
        onMuteToggle={handleMuteToggle}
      />
    </div>
  )
}

export default Player 