'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Play, Plus, List, Music } from 'lucide-react'
import { Album, Track } from '../../../types/music'
import PlaylistModal from '@/components/PlaylistModal'
import styles from './page.module.css'

export default function AlbumDetail() {
  const params = useParams()
  const router = useRouter()
  const [album, setAlbum] = useState<Album | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set())
  const [showPlaylistModal, setShowPlaylistModal] = useState(false)
  const [playingTrack, setPlayingTrack] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    loadAlbum()
  }, [params.id])

  const loadAlbum = async () => {
    try {
      const response = await fetch('/api/albums')
      if (response.ok) {
        const data = await response.json()
        const foundAlbum = data.albums.find((a: Album) => a.id === params.id)
        if (foundAlbum) {
          setAlbum(foundAlbum)
        } else {
          router.push('/')
        }
      }
    } catch (error) {
      console.error('Error loading album:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePlayAlbum = async () => {
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
        }
      } catch (error) {
        console.error('Error playing album:', error)
      }
    }
  }

  const handlePlayTrack = async (track: Track) => {
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
      } else {
        console.error('Failed to play track:', track.title)
      }
    } catch (error) {
      console.error('Error playing track:', error)
    }
  }

  const handleAddToPlaylist = () => {
    // If no tracks are selected, select all tracks
    if (selectedTracks.size === 0 && album) {
      setSelectedTracks(new Set(album.tracks.map((t: Track) => t.id)))
    }
    setShowPlaylistModal(true)
  }

  const handleAddTracksToPlaylist = async (playlistId: string, trackIds: string[]) => {
    try {
      // Get the actual track paths from the selected track IDs
      const selectedTrackPaths = trackIds.map(trackId => {
        const track = album?.tracks.find((t: Track) => t.id === trackId)
        return track?.path
      }).filter(Boolean) as string[]

      // Add tracks to the playlist
      for (const trackPath of selectedTrackPaths) {
        const response = await fetch(`/api/playlists/${playlistId}/tracks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackPath: trackPath }),
        })
        
        if (!response.ok) {
          console.error('Failed to add track to playlist:', trackPath)
        }
      }
      
      // Clear selection after adding
      setSelectedTracks(new Set())
    } catch (error) {
      console.error('Error adding tracks to playlist:', error)
    }
  }

  const handleSelectTrack = (trackId: string) => {
    const newSelected = new Set(selectedTracks)
    if (newSelected.has(trackId)) {
      newSelected.delete(trackId)
    } else {
      newSelected.add(trackId)
    }
    setSelectedTracks(newSelected)
  }

  const handleSelectAll = () => {
    if (album) {
      if (selectedTracks.size === album.tracks.length) {
        setSelectedTracks(new Set())
      } else {
        setSelectedTracks(new Set(album.tracks.map((t: Track) => t.id)))
      }
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

  if (!album) {
    return (
      <div className={styles.errorContainer}>
        <p>Album not found</p>
        <button onClick={() => router.push('/')} className={styles.backButton}>
          Back to Library
        </button>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => router.push('/')} className={styles.backButton}>
          ← Back to Library
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
            <button onClick={handlePlayAlbum} className={styles.playButton}>
              <Play className={styles.playIcon} />
              Play Album
            </button>
            <button onClick={handleAddToPlaylist} className={styles.playlistButton}>
              <Plus className={styles.plusIcon} />
              Add to Playlist
            </button>
          </div>
        </div>
      </div>

      <div className={styles.tracksSection}>
        <div className={styles.tracksHeader}>
          <h2 className={styles.tracksTitle}>Tracks</h2>
          <div className={styles.tracksActions}>
            <button 
              onClick={handleSelectAll}
              className={styles.selectAllButton}
            >
              {selectedTracks.size === album.tracks.length ? 'Deselect All' : 'Select All'}
            </button>
            {selectedTracks.size > 0 && (
              <button 
                onClick={handleAddToPlaylist}
                className={styles.addSelectedButton}
              >
                <Plus className={styles.plusIcon} />
                Add Selected ({selectedTracks.size})
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
                  onChange={() => handleSelectTrack(track.id)}
                  className={styles.checkbox}
                />
              </div>
              
              <div className={styles.trackInfo}>
                <span className={styles.trackNumber}>
                  {track.trackNumber || index + 1}
                </span>
                <div className={styles.trackDetails}>
                  <span className={styles.trackTitle}>{track.title}</span>
                </div>
              </div>

              <div className={styles.trackActions}>
                <button
                  onClick={() => handlePlayTrack(track)}
                  className={styles.playTrackButton}
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
        selectedTracks={Array.from(selectedTracks)}
        onAddToPlaylist={handleAddTracksToPlaylist}
      />
    </div>
  )
} 