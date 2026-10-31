'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Play, Plus, Music } from 'lucide-react'
import { Album, Track } from '@/types/music'
import PlaylistModal from '@/components/PlaylistModal/PlaylistModal'
import AdminAlbumManager from '@/components/AdminAlbumManager/AdminAlbumManager'
import { useSettings } from '@/contexts/SettingsContext'
import { useSearch } from '@/contexts/SearchContext'
import { useToast } from '@/contexts/ToastContext'
import { useLibrary } from '@/contexts/LibraryContext'
import { useQueueToast } from '@/components/QueueToast/QueueToastContext'
import { usePlayNow } from '@/hooks/usePlayNow'
import { usePlayback } from '@/contexts/PlaybackContext'
import styles from './page.module.css'
import Image from 'next/image'
import { cleanAlbumTrackTitles, type DisplayTitle } from '@/utils/trackTitles'

function getDisplayTitles(tracks: Track[]): Map<string, DisplayTitle> {
  const cleaned = cleanAlbumTrackTitles(tracks)
  return new Map(tracks.map((t, i) => [t.id, cleaned[i]]))
}

interface WindowWithPlayer extends Window {
  hasAddedTrackToQueue?: boolean
  checkPlayerStatusImmediately?: () => Promise<void>
}

export default function AlbumDetail(): JSX.Element {
  const params = useParams()
  const router = useRouter()
  const { canPerformAction, settings } = useSettings()
  const { hideKeyboard } = useSearch()
  const { showToast } = useToast()
  const { libraryState } = useLibrary()
  const { showQueueToast } = useQueueToast()
  const playNow = usePlayNow()
  const playback = usePlayback()
  const [album, setAlbum] = useState<Album | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set())
  const [showPlaylistModal, setShowPlaylistModal] = useState(false)
  const [flashingTrackId, setFlashingTrackId] = useState<string | null>(null)

  const loadAlbum = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/albums')
      if (response.ok) {
        const data = await response.json() as { albums: Album[] }
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
  }, [params.id])

  useEffect(() => {
    void loadAlbum()
  }, [loadAlbum])

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const triggerPlayerRefresh = (): void => {
    if (typeof window !== 'undefined') {
      (window as WindowWithPlayer).hasAddedTrackToQueue = true
      setTimeout(() => {
        void (window as WindowWithPlayer).checkPlayerStatusImmediately?.()
      }, 100)
    }
  }

  const handlePlayAlbum = async (): Promise<void> => {
    if (!canPerformAction('allowAddToQueue')) return
    if (!album || album.tracks.length === 0) return

    try {
      let lastQueueLength = 0
      if (playback.mode === 'browser') {
        // Playing on this device: start the album now, ahead of anything queued.
        await playback.playNow(album.tracks.map(track => track.path), true)
      } else {
        for (const track of album.tracks) {
          const data = await playback.addToQueue(track.path, true)
          if (data) lastQueueLength = data.queue.length
        }
      }
      hideKeyboard()
      // Show one summary toast for the whole album. Not needed when it just started playing here.
      if (playback.mode !== 'browser') showQueueToast(album.title, lastQueueLength > 0 ? lastQueueLength : null)
      triggerPlayerRefresh()
    } catch (error) {
      console.error('Error playing album:', error)
    }
  }

  const handlePlayTrack = async (track: Track): Promise<void> => {
    if (!canPerformAction('allowAddToQueue')) return

    const ok = await playNow({ path: track.path, title: track.title })
    if (ok) {
      hideKeyboard()
      setFlashingTrackId(track.id)
      setTimeout(() => setFlashingTrackId(null), 600)
      triggerPlayerRefresh()
    }
  }

  const handleAddToPlaylist = (): void => {
    if (!canPerformAction('allowCreatePlaylists')) {
      // TODO: Implement a non-blocking UI alternative for showing restricted action
      return
    }

    // If no tracks are selected, select all tracks
    if (selectedTracks.size === 0 && album) {
      setSelectedTracks(new Set(album.tracks.map((t: Track) => t.id)))
    }
    setShowPlaylistModal(true)
  }

  const handleTrackSelection = (trackId: string): void => {
    const newSelected = new Set(selectedTracks)
    if (newSelected.has(trackId)) {
      newSelected.delete(trackId)
    } else {
      newSelected.add(trackId)
    }
    setSelectedTracks(newSelected)
  }

  const handleSelectAllTracks = (): void => {
    if (album) {
      setSelectedTracks(new Set(album.tracks.map((t: Track) => t.id)))
    }
  }

  const handleDeselectAllTracks = (): void => {
    setSelectedTracks(new Set())
  }

  const handleAddSelectedToQueue = async (): Promise<void> => {
    if (!canPerformAction('allowAddToQueue')) {
      // TODO: Implement a non-blocking UI alternative for showing restricted action
      return
    }

    if (selectedTracks.size === 0 || !album) return

    try {
      const trackIds = Array.from(selectedTracks)
      let lastQueueLength = 0
      for (const trackId of trackIds) {
        const track = album.tracks.find(t => t.id === trackId)
        if (track) {
          const data = await playback.addToQueue(track.path)
          if (data) lastQueueLength = data.queue.length
        }
      }
      hideKeyboard()
      const label = trackIds.length === 1
        ? (album.tracks.find(t => t.id === trackIds[0])?.title ?? 'Track')
        : `${trackIds.length} tracks`
      showQueueToast(label, lastQueueLength > 0 ? lastQueueLength : null)
      triggerPlayerRefresh()
      setSelectedTracks(new Set())
    } catch (error) {
      console.error('Error adding tracks to queue:', error)
    }
  }

  const handleAddToPlaylistSuccess = async (playlistId: string, trackPaths: string[]): Promise<void> => {
    try {
      // Add each track individually to the playlist
      for (const trackPath of trackPaths) {
        const response = await fetch(`/api/playlists/${playlistId}/tracks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackPath }),
        })

        if (!response.ok) {
          console.error('Failed to add track to playlist:', trackPath)
        }
      }

      setShowPlaylistModal(false)
      setSelectedTracks(new Set())
      showToast(`Added ${trackPaths.length} track${trackPaths.length === 1 ? '' : 's'} to playlist`, 'success')
    } catch (error) {
      console.error('Error adding tracks to playlist:', error)
      showToast('Failed to add tracks to playlist', 'error')
    }
  }

  // Generate cover URL using the API endpoint
  const getCoverUrl = (coverPath: string | undefined): string | undefined => {
    if (!coverPath) return undefined
    return `/api/cover/${encodeURIComponent(coverPath)}`
  }

  const getBackToLibraryUrl = (): string => {
    const params = new URLSearchParams()
    if (libraryState.currentPage > 1) {
      params.set('page', libraryState.currentPage.toString())
    }
    if (libraryState.selectedLetter) {
      params.set('letter', libraryState.selectedLetter)
    }
    const queryString = params.toString()
    return queryString ? `/?${queryString}` : '/'
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <p>Loading album...</p>
      </div>
    )
  }

  if (error ?? !album) {
    return (
      <div className={styles.errorContainer}>
        <h2>Error</h2>
        <p>{error ?? 'Album not found'}</p>
        <button onClick={() => router.push(getBackToLibraryUrl())} className={styles.backButton}>
          <ArrowLeft className={styles.backIcon} />
          Back to Library
        </button>
      </div>
    )
  }

  const displayTitles = getDisplayTitles(album.tracks)
  const trackLabel = (track: Track, index: number): { title: string; number: number } => {
    const d = displayTitles.get(track.id)
    return { title: d?.title ?? track.title, number: track.trackNumber ?? d?.number ?? index + 1 }
  }
  const showArtist = album.artist && album.artist !== 'Unknown Artist'

  const canQueue = canPerformAction('allowAddToQueue')
  const canPlaylist = canPerformAction('allowCreatePlaylists')
  const queueBlockedTitle = 'Adding to queue is restricted in party mode'

  return (
    <div className={styles.container}>
      {settings.enableAdminMode && (
        <AdminAlbumManager 
          album={album} 
          onCoverUpdated={() => { void loadAlbum(); }}
        />
      )}

      <div className={styles.layout}>
        <aside className={styles.albumPanel}>
          <button onClick={() => router.push(getBackToLibraryUrl())} className={styles.backLink}>
            <ArrowLeft className={styles.backLinkIcon} />
            Library
          </button>

          <div className={styles.cover}>
            {album.coverPath ? (
              <Image 
                src={getCoverUrl(album.coverPath) ?? ''}
                alt={`${album.title} cover`}
                width={400}
                height={400}
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

          <div className={styles.info}>
            <h1 className={styles.title} title={album.title}>{album.title}</h1>
            <p className={styles.metaLine}>
              {[showArtist ? album.artist : null, album.year, `${album.tracks.length} tracks`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>

          <div className={styles.actions}>
            <button 
              onClick={() => { void handlePlayAlbum(); }}
              className={styles.playButton}
              disabled={!canQueue}
              title={!canQueue ? queueBlockedTitle : 'Play Album'}
            >
              <Play className={styles.buttonIcon} />
              Play Album
            </button>
            <button 
              onClick={() => { handleAddToPlaylist(); }}
              className={styles.playlistButton}
              disabled={!canPlaylist}
              title={!canPlaylist ? 'Creating playlists is restricted in party mode' : 'Add to Playlist'}
            >
              <Plus className={styles.buttonIcon} />
              Add to Playlist
            </button>
          </div>
        </aside>

        <div className={styles.mainColumn}>
          <section className={styles.tracksPanel}>
            <div className={styles.tracksHeader}>
              <h2 className={styles.tracksTitle}>
                {selectedTracks.size > 0 ? `${selectedTracks.size} selected` : 'Tracks'}
              </h2>
              <div className={styles.tracksActions}>
                {selectedTracks.size === 0 ? (
                  <button onClick={() => { handleSelectAllTracks(); }} className={styles.secondaryButton}>
                    Select All
                  </button>
                ) : (
                  <>
                    <button onClick={() => { handleDeselectAllTracks(); }} className={styles.secondaryButton}>
                      Clear
                    </button>
                    <button 
                      onClick={() => { void handleAddSelectedToQueue(); }}
                      className={styles.enqueueButton}
                      disabled={!canQueue}
                      title={!canQueue ? queueBlockedTitle : 'Add selected tracks to the queue'}
                    >
                      <Plus className={styles.buttonIcon} />
                      Enqueue
                    </button>
                  </>
                )}
              </div>
            </div>

            <div
              className={styles.trackList}
              style={{ '--track-rows': Math.ceil(album.tracks.length / 2) } as React.CSSProperties}
            >
              {album.tracks.map((track: Track, index: number) => {
                const label = trackLabel(track, index)
                const isSelected = selectedTracks.has(track.id)
                return (
                  <div
                    key={track.id}
                    className={`${styles.trackItem} ${isSelected ? styles.selected : ''} ${flashingTrackId === track.id ? styles.trackFlash : ''}`}
                  >
                    <label className={styles.trackSelect}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => { handleTrackSelection(track.id); }}
                        className={styles.checkbox}
                        aria-label={`Select ${label.title}`}
                      />
                      <span className={styles.trackNumber}>{label.number}</span>
                    </label>
                    <span className={styles.trackTitle} title={track.title}>{label.title}</span>
                    <button
                      onClick={() => { void handlePlayTrack(track); }}
                      className={styles.playTrackButton}
                      disabled={!canQueue}
                      title={!canQueue ? queueBlockedTitle : 'Play track'}
                      aria-label={`Play ${label.title}`}
                    >
                      <Play className={styles.playTrackIcon} />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          {album.setlistInfo && settings.showConcertDetails && (
            <details className={styles.setlistSection}>
              <summary className={styles.setlistTitle}>Concert Setlist &amp; Notes</summary>
              <div className={styles.setlistFilename}>{album.setlistInfo.filename}</div>
              <pre className={styles.setlistContent}>{album.setlistInfo.content}</pre>
            </details>
          )}
        </div>
      </div>

      <PlaylistModal
        isOpen={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        selectedTracks={Array.from(selectedTracks).map(id => 
          album.tracks.find(t => t.id === id)?.path ?? ''
        ).filter(Boolean)}
        onAddToPlaylist={(playlistId, trackPaths) => { void handleAddToPlaylistSuccess(playlistId, trackPaths); }}
      />
    </div>
  )
} 