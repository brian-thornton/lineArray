'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Play, Clock, Music } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { useSearch } from '@/contexts/SearchContext'
import styles from './RecentlyPlayed.module.css'

interface WindowWithPlayer extends Window {
  hasAddedTrackToQueue?: boolean
  checkPlayerStatusImmediately?: () => Promise<void>
}

interface RecentlyPlayedTrack {
  id: string
  path: string
  title: string
  artist: string
  album: string
  playCount: number
  lastPlayed: string
}

interface RecentlyPlayedProps {
  limit?: number
  showTitle?: boolean
}

export default function RecentlyPlayed({ limit = 10, showTitle = true }: RecentlyPlayedProps): JSX.Element {
  const { canPerformAction } = useSettings()
  const { hideKeyboard } = useSearch()
  const [recentTracks, setRecentTracks] = useState<RecentlyPlayedTrack[]>([])
  const [loading, setLoading] = useState(true)

  const loadRecentlyPlayed = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/playcounts')
      
      if (response.ok) {
        const data = await response.json() as { tracks: RecentlyPlayedTrack[] }
        
        if (data.tracks && data.tracks.length > 0) {
          // Sort by last played time (most recent first) and take the top tracks
          const sorted = data.tracks
            .sort((a: RecentlyPlayedTrack, b: RecentlyPlayedTrack) => new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime())
            .slice(0, limit)
          setRecentTracks(sorted)
        } else {
          setRecentTracks([])
        }
      } else {
        console.error('Failed to fetch play counts:', response.status, response.statusText)
        setRecentTracks([])
      }
    } catch (error) {
      console.error('Error loading recently played:', error)
      setRecentTracks([])
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    void loadRecentlyPlayed()
  }, [loadRecentlyPlayed])

  const handlePlayTrack = async (path: string): Promise<void> => {
    if (!canPerformAction('allowAddToQueue')) {
      console.error('Adding to queue is restricted in party mode')
      return
    }

    try {
      const response = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })

      if (response.ok) {
        hideKeyboard()
        
        // Set flag to show player controls
        if (typeof window !== 'undefined') {
          (window as WindowWithPlayer).hasAddedTrackToQueue = true
        }
        
        // Immediately check player status to show controls faster
        if (typeof window !== 'undefined' && (window as WindowWithPlayer).checkPlayerStatusImmediately) {
          setTimeout(() => {
            void (window as WindowWithPlayer).checkPlayerStatusImmediately?.()
          }, 100)
        }
      } else {
        console.error('Failed to add track to queue')
      }
    } catch (error) {
      console.error('Error adding track to queue:', error)
    }
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) {
      return 'Just now'
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
      return `${diffInDays}d ago`
    }
  }

  const getTrackName = (path: string): string => {
    const pathParts = path.split('/')
    const filename = pathParts[pathParts.length - 1]
    return filename.replace(/\.[^/.]+$/, '')
  }

  if (loading) {
    return (
      <div className={styles.container}>
        {showTitle && <h3 className={styles.title}>Recently Played</h3>}
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (recentTracks.length === 0) {
    return (
      <div className={styles.container}>
        {showTitle && <h3 className={styles.title}>Recently Played</h3>}
        <div className={styles.empty}>
          <Music className={styles.emptyIcon} />
          <p>No tracks played yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {showTitle && <h3 className={styles.title}>Recently Played</h3>}
      
      <div className={styles.trackList}>
        {recentTracks.map((track, index) => (
          <div key={track.id} className={styles.trackItem}>
            <div className={styles.trackInfo}>
              <div className={styles.trackNumber}>
                {index + 1}
              </div>
              <div className={styles.trackDetails}>
                <div className={styles.trackTitle}>
                  {track.title || getTrackName(track.path)}
                </div>
                <div className={styles.trackAlbum}>
                  {track.album || 'Unknown Album'}
                </div>
                <div className={styles.trackMeta}>
                  <span className={styles.playCount}>
                    {track.playCount} {track.playCount === 1 ? 'play' : 'plays'}
                  </span>
                  <span className={styles.lastPlayed}>
                    <Clock className={styles.clockIcon} />
                    {formatDate(track.lastPlayed)}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.trackActions}>
              <button
                onClick={() => { void handlePlayTrack(track.path) }}
                className={styles.playButton}
                disabled={!canPerformAction('allowAddToQueue')}
                title={!canPerformAction('allowAddToQueue') ? 'Adding to queue is restricted in party mode' : 'Play track'}
              >
                <Play className={styles.playIcon} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 