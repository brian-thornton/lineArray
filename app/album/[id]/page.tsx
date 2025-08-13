'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Play, Plus, Music } from 'lucide-react'
import { Album, Track } from '@/types/music'
import PlaylistModal from '@/components/PlaylistModal/PlaylistModal'
import SearchResults from '@/components/SearchResults/SearchResults'
import AdminAlbumManager from '@/components/AdminAlbumManager/AdminAlbumManager'
import { useSettings } from '@/contexts/SettingsContext'
import { useSearch } from '@/contexts/SearchContext'
import { useToast } from '@/contexts/ToastContext'
import { useLibrary } from '@/contexts/LibraryContext'
import styles from './page.module.css'
import Image from 'next/image'

interface WindowWithPlayer extends Window {
  hasAddedTrackToQueue?: boolean
  checkPlayerStatusImmediately?: () => Promise<void>
}

export default function AlbumDetail(): JSX.Element {
  const params = useParams()
  const router = useRouter()
  const { canPerformAction, settings } = useSettings()
  const { searchQuery, searchResults, isSearching, addTrackToQueue, hideKeyboard } = useSearch()
  const { showToast } = useToast()
  const { libraryState } = useLibrary()
  const [album, setAlbum] = useState<Album | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set())
  const [showPlaylistModal, setShowPlaylistModal] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

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

  // Determine which layout to use - mobile always overrides user preferences
  const effectiveLayout = isMobile ? 'mobile' : 
    settings.useSideBySideAlbumLayout ? 'sideBySide' : 
    settings.useMobileAlbumLayout ? 'mobile' : 'default'

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

  const handlePlayAlbum = async (): Promise<void> => {
    if (!canPerformAction('allowAddToQueue')) {
      // TODO: Implement a non-blocking UI alternative for showing restricted action
      return
    }

    if (album && album.tracks.length > 0) {
      try {
        // Add all tracks to queue with album flag
        for (const track of album.tracks) {
          const response = await fetch('/api/queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              path: track.path,
              isAlbum: true 
            }),
          })
          
          if (!response.ok) {
            console.error(`Failed to add track to queue: ${track.title}`)
          }
        }
        
        // Start playing the first track
        const response = await fetch('/api/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            path: album.tracks[0].path,
            isAlbum: true 
          }),
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
        }
      } catch (error) {
        console.error('Error playing album:', error)
      }
    }
  }

  const handlePlayTrack = async (track: Track): Promise<void> => {
    if (!canPerformAction('allowAddToQueue')) {
      // TODO: Implement a non-blocking UI alternative for showing restricted action
      return
    }

    try {
      const response = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          path: track.path,
          isAlbum: false 
        }),
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
        console.error('Failed to play track:', track.title)
      }
    } catch (error) {
      console.error('Error playing track:', error)
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
      // Add all selected tracks to queue
      for (const trackId of Array.from(selectedTracks)) {
        const track = album.tracks.find(t => t.id === trackId)
        if (track) {
          const response = await fetch('/api/queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: track.path }),
          })
          
          if (!response.ok) {
            console.error(`Failed to add track to queue: ${track.title}`)
          }
        }
      }
      
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
      
      // Clear selection after adding to queue
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

  const handleTrackClick = async (path: string): Promise<void> => {
    await addTrackToQueue(path)
    hideKeyboard()
    
    // Find the track title for the toast
    const track = searchResults.find(result => result.path === path)
    if (track) {
      showToast(`Added "${track.title}" to queue`, 'success')
    }
    
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
  }

  // Show search results if there's an active search
  if (searchQuery) {
    return (
      <div className={styles.container}>
        <SearchResults 
          results={searchResults}
          onTrackClick={path => { void handleTrackClick(path); }}
          isLoading={isSearching}
        />
      </div>
    )
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => router.push(getBackToLibraryUrl())} className={styles.backButton}>
          <ArrowLeft className={styles.backIcon} />
          Back to Library
        </button>
        {effectiveLayout === 'mobile' && album && (
          <div className={styles.mobileHeaderInfo}>
            <div className={styles.mobileHeaderCover}>
              {album.coverPath ? (
                <Image 
                  src={getCoverUrl(album.coverPath) ?? ''}
                  alt={`${album.title} cover`}
                  width={40}
                  height={40}
                  className={styles.mobileHeaderCoverImage}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    target.nextElementSibling?.classList.remove(styles.hidden)
                  }}
                />
              ) : null}
              <div className={`${styles.mobileHeaderDefaultCover} ${album.coverPath ? styles.hidden : ''}`} />
            </div>
            <div className={styles.mobileHeaderText}>
              <h1 className={styles.mobileHeaderTitle}>{album.title}</h1>
              {album.year && <p className={styles.mobileHeaderYear}>{album.year}</p>}
            </div>
          </div>
        )}
      </div>

      {settings.enableAdminMode && album && (
        <AdminAlbumManager 
          album={album} 
          onCoverUpdated={() => { void loadAlbum(); }}
        />
      )}

            {effectiveLayout === 'default' && (
        <div className={styles.albumInfo}>
          <div className={styles.coverSection}>
            <div className={styles.cover}>
              {album.coverPath ? (
                <Image 
                  src={getCoverUrl(album.coverPath) ?? ''}
                  alt={`${album.title} cover`}
                  width={300}
                  height={300}
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

            <div className={styles.actions}>
              <button 
                onClick={() => { void handlePlayAlbum(); }}
                className={styles.playButton}
                disabled={!canPerformAction('allowAddToQueue')}
                title={!canPerformAction('allowAddToQueue') ? 'Adding to queue is restricted in party mode' : 'Play Album'}
              >
                <Play className={styles.playIcon} />
                Play Album
              </button>
              <button 
                onClick={() => { handleAddToPlaylist(); }}
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
      )}

      {effectiveLayout === 'sideBySide' && (
        <div className={styles.sideBySideLayout}>
          <div className={styles.sideBySideLeft}>
            <div className={styles.sideBySideCover}>
              {album.coverPath ? (
                <Image 
                  src={getCoverUrl(album.coverPath) ?? ''}
                  alt={`${album.title} cover`}
                  width={350}
                  height={400}
                  className={styles.sideBySideCoverImage}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    target.nextElementSibling?.classList.remove(styles.hidden)
                  }}
                />
              ) : null}
              <div className={`${styles.sideBySideDefaultCover} ${album.coverPath ? styles.hidden : ''}`}>
                <Music className={styles.sideBySideDefaultIcon} />
              </div>
            </div>
            
            <div className={styles.sideBySideInfo}>
              <h1 className={styles.sideBySideTitle}>{album.title}</h1>
              {album.year && <p className={styles.sideBySideYear}>{album.year}</p>}
              <span className={styles.sideBySideTrackCount}>
                {album.tracks.length} tracks
              </span>

              <div className={styles.sideBySideActions}>
                <button 
                  onClick={() => { void handlePlayAlbum(); }}
                  className={styles.sideBySidePlayButton}
                  disabled={!canPerformAction('allowAddToQueue')}
                  title={!canPerformAction('allowAddToQueue') ? 'Adding to queue is restricted in party mode' : 'Play Album'}
                >
                  <Play className={styles.sideBySidePlayIcon} />
                  Play Album
                </button>
                <button 
                  onClick={() => { handleAddToPlaylist(); }}
                  className={styles.sideBySidePlaylistButton}
                  disabled={!canPerformAction('allowCreatePlaylists')}
                  title={!canPerformAction('allowCreatePlaylists') ? 'Creating playlists is restricted in party mode' : 'Add to Playlist'}
                >
                  <Plus className={styles.sideBySidePlusIcon} />
                  Add to Playlist
                </button>
              </div>
            </div>
          </div>

          <div className={styles.sideBySideRight}>
            <div className={styles.sideBySideTracksHeader}>
              <h2 className={styles.sideBySideTracksTitle}>Tracks</h2>
              <div className={styles.sideBySideTracksActions}>
                {selectedTracks.size === 0 ? (
                  <button onClick={() => { handleSelectAllTracks(); }} className={styles.sideBySideSelectAllButton}>
                    Select All Tracks
                  </button>
                ) : (
                  <button onClick={() => { handleDeselectAllTracks(); }} className={styles.sideBySideSelectAllButton}>
                    Deselect All ({selectedTracks.size})
                  </button>
                )}
                {selectedTracks.size > 0 && (
                  <button 
                    onClick={() => { void handleAddSelectedToQueue(); }}
                    className={styles.sideBySideAddSelectedButton}
                    disabled={!canPerformAction('allowAddToQueue')}
                    title={!canPerformAction('allowAddToQueue') ? 'Adding to queue is restricted in party mode' : 'Add Selected to Queue'}
                  >
                    <Play className={styles.sideBySidePlayIcon} />
                    Add Selected to Queue
                  </button>
                )}
              </div>
            </div>

            <div className={styles.sideBySideTrackList}>
              {album.tracks.map((track: Track, index: number) => (
                <div 
                  key={track.id} 
                  className={`${styles.sideBySideTrackItem} ${selectedTracks.has(track.id) ? styles.selected : ''}`}
                >
                  <div className={styles.sideBySideTrackCheckbox}>
                    <input
                      type="checkbox"
                      checked={selectedTracks.has(track.id)}
                      onChange={() => { handleTrackSelection(track.id); }}
                      className={styles.sideBySideCheckbox}
                    />
                  </div>
                  
                  <div className={styles.sideBySideTrackInfo}>
                    <span className={styles.sideBySideTrackNumber}>
                      {track.trackNumber ?? index + 1}
                    </span>
                    <div className={styles.sideBySideTrackDetails}>
                      <span className={styles.sideBySideTrackTitle}>{track.title}</span>
                    </div>
                  </div>
                  
                  <div className={styles.sideBySideTrackActions}>
                    <button
                      onClick={() => { void handlePlayTrack(track); }}
                      className={styles.sideBySidePlayTrackButton}
                      disabled={!canPerformAction('allowAddToQueue')}
                      title={!canPerformAction('allowAddToQueue') ? 'Adding to queue is restricted in party mode' : 'Play track'}
                      aria-label={`Play ${track.title}`}
                    >
                      <Play className={styles.sideBySidePlayIcon} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {album.setlistInfo && settings.showConcertDetails && effectiveLayout !== 'sideBySide' && (
        <div className={styles.setlistSection}>
          <h3 className={styles.setlistTitle}>Concert Setlist & Notes</h3>
          <div className={styles.setlistFilename}>{album.setlistInfo.filename}</div>
          <pre className={styles.setlistContent}>{album.setlistInfo.content}</pre>
        </div>
      )}

      {effectiveLayout !== 'sideBySide' && (
        <div className={styles.tracksSection}>
          <div className={styles.tracksHeader}>
            <div className={styles.tracksHeaderLeft}>
              <h2 className={styles.tracksTitle}>Tracks</h2>
              {effectiveLayout === 'mobile' && (
                <div className={styles.mobileHeaderActions}>
                  <button 
                    onClick={() => { void handlePlayAlbum(); }}
                    className={styles.mobileHeaderPlayButton}
                    disabled={!canPerformAction('allowAddToQueue')}
                    title={!canPerformAction('allowAddToQueue') ? 'Adding to queue is restricted in party mode' : 'Play Album'}
                  >
                    <Play className={styles.mobileHeaderPlayIcon} />
                    Play Album
                  </button>
                  <button 
                    onClick={() => { handleAddToPlaylist(); }}
                    className={styles.mobileHeaderPlaylistButton}
                    disabled={!canPerformAction('allowCreatePlaylists')}
                    title={!canPerformAction('allowCreatePlaylists') ? 'Creating playlists is restricted in party mode' : 'Add to Playlist'}
                  >
                    <Plus className={styles.mobileHeaderPlusIcon} />
                    Add to Playlist
                  </button>
                </div>
              )}
            </div>
            <div className={styles.tracksActions}>
              {selectedTracks.size === 0 ? (
                <button onClick={() => { handleSelectAllTracks(); }} className={styles.selectAllButton}>
                  Select All Tracks
                </button>
              ) : (
                <button onClick={() => { handleDeselectAllTracks(); }} className={styles.selectAllButton}>
                  Deselect All ({selectedTracks.size})
                </button>
              )}
              {selectedTracks.size > 0 && (
                <button 
                  onClick={() => { void handleAddSelectedToQueue(); }}
                  className={styles.addSelectedButton}
                  disabled={!canPerformAction('allowAddToQueue')}
                  title={!canPerformAction('allowAddToQueue') ? 'Adding to queue is restricted in party mode' : 'Add Selected to Queue'}
                >
                  <Play className={styles.playIcon} />
                  Add Selected to Queue
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
                    onChange={() => { handleTrackSelection(track.id); }}
                    className={styles.checkbox}
                  />
                </div>
                
                <div className={styles.trackInfo}>
                  <span className={styles.trackNumber}>
                    {track.trackNumber ?? index + 1}
                  </span>
                  <div className={styles.trackDetails}>
                    <span className={styles.trackTitle}>{track.title}</span>
                  </div>
                </div>
                
                <div className={styles.trackActions}>
                  <button
                    onClick={() => { void handlePlayTrack(track); }}
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
      )}

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