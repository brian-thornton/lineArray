"use client"

import React, { useState, useEffect } from 'react'
import { Play, Pause, SkipForward, Square, Trash2 } from 'lucide-react'
import styles from './Player.module.css'

interface PlayerStatus {
  isPlaying: boolean
  currentTrack: string | null
  queue: string[]
}

const Player: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>({
    isPlaying: false,
    currentTrack: null,
    queue: []
  })

  // Poll for player status every 2 seconds
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const response = await fetch('/api/queue')
        if (response.ok) {
          const data = await response.json()
          setPlayerStatus(prev => ({
            ...prev,
            isPlaying: data.isPlaying,
            currentTrack: data.currentTrack,
            queue: data.queue
          }))
        }
      } catch (error) {
        console.error('Error polling player status:', error)
      }
    }

    pollStatus()
    const interval = setInterval(pollStatus, 2000)
    return () => clearInterval(interval)
  }, [])

  const handlePlayPause = async () => {
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
    setLoading(true)
    try {
      const response = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      })
      
      if (response.ok) {
        setPlayerStatus(prev => ({ ...prev, isPlaying: false, currentTrack: null }))
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
    setLoading(true)
    try {
      const response = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip' }),
      })
      
      if (response.ok) {
        console.log('Skipped to next track')
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
          queue: data.queue
        }))
        console.log('Queue cleared')
      } else {
        console.error('Failed to clear queue')
      }
    } catch (error) {
      console.error('Error clearing queue:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCurrentTrackName = (): string => {
    if (!playerStatus.currentTrack) return 'No track playing'
    
    // Extract filename from path
    const pathParts = playerStatus.currentTrack.split('/')
    const filename = pathParts[pathParts.length - 1]
    
    // Remove file extension
    return filename.replace(/\.[^/.]+$/, '')
  }

  // Don't render if no track is playing and queue is empty
  if (!playerStatus.currentTrack && playerStatus.queue.length === 0 && !playerStatus.isPlaying) {
    return null
  }

  return (
    <div className={styles.player}>
      <div className={styles.content}>
        <div className={styles.trackInfo}>
          <div className={styles.cover}>
            <div className={styles.coverPlaceholder}>🎵</div>
          </div>
          <div className={styles.info}>
            <h3 className={styles.title}>
              {playerStatus.currentTrack ? getCurrentTrackName() : 'No track playing'}
            </h3>
            <p className={styles.artist}>
              {playerStatus.isPlaying ? 'Playing' : 'Stopped'} • 
              Queue: {playerStatus.queue.length} tracks
            </p>
            <p className={styles.album}>
              {playerStatus.currentTrack ? playerStatus.currentTrack : 'Ready to play'}
            </p>
          </div>
        </div>
        
        <div className={styles.controls}>
          <div className={styles.mainControls}>
            <button
              className={styles.controlButton}
              onClick={handlePlayPause}
              disabled={loading}
              aria-label={playerStatus.isPlaying ? 'Pause' : 'Play'}
            >
              {playerStatus.isPlaying ? <Pause className={styles.controlIcon} /> : <Play className={styles.controlIcon} />}
            </button>
            <button
              className={styles.controlButton}
              onClick={handleSkip}
              disabled={loading || playerStatus.queue.length <= 1}
              aria-label="Skip to next track"
            >
              <SkipForward className={styles.controlIcon} />
            </button>
            <button
              className={styles.controlButton}
              onClick={handleStop}
              disabled={loading}
              aria-label="Stop playback"
            >
              <Square className={styles.controlIcon} />
            </button>
            <button
              className={`${styles.controlButton} ${styles.clearButton}`}
              onClick={handleClearQueue}
              disabled={loading || playerStatus.queue.length === 0}
              aria-label="Clear queue"
              title="Clear queue"
            >
              <Trash2 className={styles.controlIcon} />
            </button>
          </div>
          
          <div className={styles.status}>
            {playerStatus.queue.length > 0 && (
              <span className={styles.queueInfo}>
                • {playerStatus.queue.length} in queue
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Player 