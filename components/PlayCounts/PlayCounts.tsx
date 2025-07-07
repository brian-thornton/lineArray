"use client"

import { useState, useEffect } from 'react'
import { BarChart3, Music, TrendingUp, Calendar } from 'lucide-react'
import styles from './PlayCounts.module.css'

interface PlayCountData {
  trackPath: string
  count: number
  title: string
  artist: string
  album: string
}

interface PlayCountsApiResponse {
  tracks: PlayCountData[]
  lastUpdated: string | null
  totalTracks: number
  totalPlays: number
}

export default function PlayCounts(): JSX.Element {
  const [playCounts, setPlayCounts] = useState<PlayCountData[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [totalTracks, setTotalTracks] = useState(0)
  const [totalPlays, setTotalPlays] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadPlayCounts()
  }, [])

  const loadPlayCounts = async (): Promise<void> => {
    try {
      setLoading(true)
      const response = await fetch('/api/playcounts')
      
      if (response.ok) {
        const data = await response.json() as PlayCountsApiResponse
        setPlayCounts(data.tracks)
        setLastUpdated(data.lastUpdated)
        setTotalTracks(data.totalTracks)
        setTotalPlays(data.totalPlays);
      } else {
        setError('Failed to load play counts')
      }
    } catch (error) {
      console.error('Error loading play counts:', error)
      setError('Failed to load play counts')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  const getTotalPlays = (): number => {
    return totalPlays;
  }

  const getAveragePlays = (): number => {
    if (totalTracks === 0) return 0;
    return totalPlays > 0 ? Math.round(totalPlays / totalTracks) : 0;
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading play statistics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={() => { void loadPlayCounts() }} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <BarChart3 className={styles.titleIcon} />
          Play Statistics
        </h2>
        <button onClick={() => { void loadPlayCounts() }} className={styles.refreshButton}>
          Refresh
        </button>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Music />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{totalTracks}</div>
            <div className={styles.statLabel}>Tracks Played</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <TrendingUp />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{getTotalPlays()}</div>
            <div className={styles.statLabel}>Total Plays</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <BarChart3 />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{getAveragePlays()}</div>
            <div className={styles.statLabel}>Avg Plays/Track</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Calendar />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>
              {lastUpdated ? 'Updated' : 'Never'}
            </div>
            <div className={styles.statLabel}>
              {formatDate(lastUpdated)}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Top 100 Most Played Songs</h3>
        
        {(!Array.isArray(playCounts) || playCounts.length === 0) ? (
          <div className={styles.emptyState}>
            <Music className={styles.emptyIcon} />
            <p>No play data available yet. Start playing some music!</p>
          </div>
        ) : (
          <div className={styles.playCountsList}>
            {playCounts.map((track, index) => (
              <div key={track.trackPath} className={styles.trackItem}>
                <div className={styles.rank}>
                  #{index + 1}
                </div>
                
                <div className={styles.trackInfo}>
                  <div className={styles.trackTitle}>{track.title}</div>
                  <div className={styles.trackDetails}>
                    {track.artist} • {track.album}
                  </div>
                </div>
                
                <div className={styles.playCount}>
                  <span className={styles.countNumber}>{track.count}</span>
                  <span className={styles.countLabel}>
                    {track.count === 1 ? 'play' : 'plays'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 