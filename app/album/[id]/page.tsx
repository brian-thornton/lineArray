'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Play, Plus, Music } from 'lucide-react'
import { Album, Track } from '@/types/music'
import PlaylistModal from '@/components/PlaylistModal/PlaylistModal'
import { useSettings } from '@/contexts/SettingsContext'
import { useSearch } from '@/contexts/SearchContext'
import styles from './page.module.css'

export default function AlbumDetail() {
  const params = useParams()
  const router = useRouter()
  const { canPerformAction } = useSettings()
  const { hideKeyboard } = useSearch()
  const [album, setAlbum] = useState<Album | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set())
  const [showPlaylistModal, setShowPlaylistModal] = useState(false)
  const [playingTrack, setPlayingTrack] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    loadAlbum()
  }, [params.id])

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const loadAlbum = async () => {
    try {
      const response = await fetch('/api/albums')
      if (response.ok) {
        const data = await response.json()
        const foundAlbum = data.albums.find((a: Album) => a.id === params.id)
        if (foundAlbum) {
          setAlbum(foundAlbum)
        } else {
          setError('Album not found')
        }
      } else {
        setError('Failed to load album')
      }
    } catch (error) {
      console.error('Error loading album:', error)
      setError('Failed to load album')
    } finally {
      setLoading(false)
    }
  }

  const handlePlayAlbum = async () => {
    if (!canPerformAction('allowAddToQueue')) {
      alert('Adding to queue is restricted in party mode')
      return
    }

    if (album && album.tracks.length > 0) {
      try {
        // Add all tracks to queue
        for (const track of album.tracks) {
          const response = await fetch('/api/queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: track.path }),
          })
          
          if (!response.ok) {
            console.error(`Failed to add track to queue: ${track.title}`)
          }
        }
        
        // Start playing the first track
        const response = await fetch('/api/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: album.tracks[0].path }),
        })
        
        if (response.ok) {
          const data = await response.json()
          setPlayingTrack(album.tracks[0].id)
          setIsPlaying(data.isPlaying)
          hideKeyboard()
          
          // Set flag to show player controls
          if (typeof window !== 'undefined') {
            (window as any).hasAddedTrackToQueue = true
          }
          
          // Immediately check player status to show controls faster
          if (typeof window !== 'undefined' && (window as any).checkPlayerStatusImmediately) {
            setTimeout(() => {
              (window as any).checkPlayerStatusImmediately()
            }, 100)
          }
        }
      } catch (error) {
        console.error('Error playing album:', error)
      }
    }
  }

  const handlePlayTrack = async (track: Track) => {
    if (!canPerformAction('allowAddToQueue')) {
      alert('Adding to queue is restricted in party mode')
      return
    }

    try {
      const response = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: track.path }),
      })
      
              if (response.ok) {
          const data = await response.json()
          setPlayingTrack(track.id)
          setIsPlaying(data.isPlaying)
          hideKeyboard()
          
          // Set flag to show player controls
          if (typeof window !== 'undefined') {
            (window as any).hasAddedTrackToQueue = true
          }
          
          // Immediately check player status to show controls faster
          if (typeof window !== 'undefined' && (window as any).checkPlayerStatusImmediately) {
            setTimeout(() => {
              (window as any).checkPlayerStatusImmediately()
            }, 100)
          }
        } else {
        console.error('Failed to play track:', track.title)
      }
    } catch (error) {
      console.error('Error playing track:', error)
    }
  }

  const handleAddToPlaylist = () => {
    if (!canPerformAction('allowCreatePlaylists')) {
      alert('Creating playlists is restricted in party mode')
      return
    }

    // If no tracks are selected, select all tracks
    if (selectedTracks.size === 0 && album) {
      setSelectedTracks(new Set(album.tracks.map((t: Track) => t.id)))
    }
    setShowPlaylistModal(true)
  }

  const handleTrackSelection = (trackId: string) => {
    const newSelected = new Set(selectedTracks)
    if (newSelected.has(trackId)) {
      newSelected.delete(trackId)
    } else {
      newSelected.add(trackId)
    }
    setSelectedTracks(newSelected)
  }

  const handleSelectAllTracks = () => {
    if (album) {
      setSelectedTracks(new Set(album.tracks.map((t: Track) => t.id)))
    }
  }

  const handleDeselectAllTracks = () => {
    setSelectedTracks(new Set())
  }

  const handleAddToPlaylistSuccess = async (playlistId: string, trackPaths: string[]) => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackPaths }),
      })

      if (response.ok) {
        setShowPlaylistModal(false)
        setSelectedTracks(new Set())
        // You could show a success message here
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to add tracks to playlist')
      }
    } catch (error) {
      console.error('Error adding tracks to playlist:', error)
      alert('Failed to add tracks to playlist')
    }
  }

  // Generate cover URL using the API endpoint
  const getCoverUrl = (coverPath: string | undefined) => {
    if (!coverPath) return undefined
    return `/api/cover/${encodeURIComponent(coverPath)}`
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading album...</p>
      </div>
    )
  }

  if (error || !album) {
    return (
      <div className={styles.errorContainer}>
        <h2>Error</h2>
        <p>{error || 'Album not found'}</p>
        <button onClick={() => router.push('/')} className={styles.backButton}>
          <ArrowLeft className={styles.backIcon} />
          Back to Library
        </button>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => router.push('/')} className={styles.backButton}>
          <ArrowLeft className={styles.backIcon} />
          Back to Library
        </button>
      </div>

      <div className={styles.albumInfo}>
        <div className={styles.coverSection}>
          <div className={styles.cover}>
            {album.coverPath ? (
              <img 
                src={getCoverUrl(album.coverPath)}
                alt={`${album.title} cover`}
                className={styles.coverImage}
                onError={(e) => {
                  // Fallback to default cover if image fails to load
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  target.nextElementSibling?.classList.remove(styles.hidden)
                }}
              />
            ) : null}
            <div className={`${styles.defaultCover} ${album.coverPath ? styles.hidden : ''}`}>
              <Music className={styles.defaultIcon} />
            </div>
          </div>
          <span className={styles.trackCount}>
            {album.tracks.length} tracks
          </span>
        </div>

        <div className={styles.infoSection}>
          <h1 className={styles.title}>{album.title}</h1>
          {album.year && <p className={styles.year}>{album.year}</p>}
          
          <div className={styles.meta}>
            <span className={styles.trackCount}>
              {album.tracks.length} tracks
            </span>
          </div>

          <div className={styles.actions}>
            <button 
              onClick={handlePlayAlbum} 
              className={styles.playButton}
              disabled={!canPerformAction('allowAddToQueue')}
              title={!canPerformAction('allowAddToQueue') ? 'Adding to queue is restricted in party mode' : 'Play Album'}
            >
              <Play className={styles.playIcon} />
              Play Album
            </button>
            <button 
              onClick={handleAddToPlaylist} 
              className={styles.playlistButton}
              disabled={!canPerformAction('allowCreatePlaylists')}
              title={!canPerformAction('allowCreatePlaylists') ? 'Creating playlists is restricted in party mode' : 'Add to Playlist'}
            >
              <Plus className={styles.plusIcon} />
              Add to Playlist
            </button>
          </div>
        </div>
      </div>

      {album.setlistInfo && (
        <div className={styles.setlistSection}>
          <h3 className={styles.setlistTitle}>Concert Setlist & Notes</h3>
          <div className={styles.setlistFilename}>{album.setlistInfo.filename}</div>
          <pre className={styles.setlistContent}>{album.setlistInfo.content}</pre>
        </div>
      )}

      <div className={styles.tracksSection}>
        <div className={styles.tracksHeader}>
          <h2 className={styles.tracksTitle}>Tracks</h2>
          <div className={styles.tracksActions}>
            {selectedTracks.size === 0 ? (
              <button onClick={handleSelectAllTracks} className={styles.selectAllButton}>
                Select All Tracks
              </button>
            ) : (
              <button onClick={handleDeselectAllTracks} className={styles.selectAllButton}>
                Deselect All ({selectedTracks.size})
              </button>
            )}
          </div>
        </div>

        <div className={styles.trackList}>
          {album.tracks.map((track: Track, index: number) => (
            <div 
              key={track.id} 
              className={`${styles.trackItem} ${selectedTracks.has(track.id) ? styles.selected : ''}`}
            >
              <div className={styles.trackCheckbox}>
                <input
                  type="checkbox"
                  checked={selectedTracks.has(track.id)}
                  onChange={() => handleTrackSelection(track.id)}
                  className={styles.checkbox}
                />
              </div>
              
              <div className={styles.trackInfo}>
                <span className={styles.trackNumber}>
                  {track.trackNumber || index + 1}
                </span>
                <div className={styles.trackDetails}>
                  <span className={styles.trackTitle}>{track.title}</span>
                  <span className={styles.trackDuration}>{track.duration}</span>
                </div>
              </div>
              
              <div className={styles.trackActions}>
                <button
                  onClick={() => handlePlayTrack(track)}
                  className={styles.playTrackButton}
                  disabled={!canPerformAction('allowAddToQueue')}
                  title={!canPerformAction('allowAddToQueue') ? 'Adding to queue is restricted in party mode' : 'Play track'}
                  aria-label={`Play ${track.title}`}
                >
                  <Play className={styles.playIcon} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <PlaylistModal
        isOpen={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        selectedTracks={Array.from(selectedTracks).map(id => 
          album.tracks.find(t => t.id === id)?.path || ''
        ).filter(Boolean)}
        onAddToPlaylist={handleAddToPlaylistSuccess}
      />
    </div>
  )
} 