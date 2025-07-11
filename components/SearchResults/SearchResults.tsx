'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import PlaylistModal from '../PlaylistModal'
import { useSettings } from '@/contexts/SettingsContext'
import styles from './SearchResults.module.css'

interface SearchResult {
  type: 'album' | 'track'
  id: string
  title: string
  artist: string
  album?: string
  path?: string
}

interface SearchResultsProps {
  results: SearchResult[]
  onTrackClick: (path: string) => void
  isLoading: boolean
}

export default function SearchResults({ results, onTrackClick, isLoading }: SearchResultsProps): JSX.Element {
  const { canPerformAction } = useSettings()
  const [showPlaylistModal, setShowPlaylistModal] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Searching...</p>
        </div>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>No results found</p>
        </div>
      </div>
    )
  }

  const handleTrackClick = (e: React.MouseEvent, path: string): void => {
    e.preventDefault()
    if (!canPerformAction('allowAddToQueue')) {
      console.error('Adding to queue is restricted in party mode')
      return
    }
    onTrackClick(path)
  }

  const handleAddToPlaylist = (e: React.MouseEvent, trackPath: string): void => {
    e.preventDefault()
    e.stopPropagation()
    if (!canPerformAction('allowCreatePlaylists')) {
      console.error('Creating playlists is restricted in party mode')
      return
    }
    setSelectedTrack(trackPath)
    setShowPlaylistModal(true)
  }

  const handleAddTrackToPlaylist = async (playlistId: string, trackPaths: string[]): Promise<void> => {
    try {
      // Add track to the playlist
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
    } catch (error) {
      console.error('Error adding track to playlist:', error)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.results}>
        {results.map((result) => (
          <div key={result.id} className={styles.resultItem}>
            {result.type === 'album' ? (
              <Link href={`/album/${result.id}`} className={styles.albumResult}>
                <div className={styles.resultIcon}>📀</div>
                <div className={styles.resultContent}>
                  <div className={styles.resultTitle}>{result.title}</div>
                  <div className={styles.resultType}>Album</div>
                </div>
              </Link>
            ) : (
              <div className={styles.trackResultContainer}>
                {result.path && (
                  <>
                    <button
                      onClick={(e) => handleTrackClick(e, result.path as string)}
                      className={styles.trackResult}
                      disabled={!canPerformAction('allowAddToQueue')}
                      title={!canPerformAction('allowAddToQueue') ? 'Adding to queue is restricted in party mode' : 'Play track'}
                    >
                      <div className={styles.resultIcon}>🎵</div>
                      <div className={styles.resultContent}>
                        <div className={styles.resultTitle}>{result.title}</div>
                        <div className={styles.resultAlbum}>{result.album}</div>
                        <div className={styles.resultType}>Track</div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => handleAddToPlaylist(e, result.path as string)}
                      className={styles.addToPlaylistButton}
                      disabled={!canPerformAction('allowCreatePlaylists')}
                      title={!canPerformAction('allowCreatePlaylists') ? 'Creating playlists is restricted in party mode' : 'Add to Playlist'}
                    >
                      <Plus className={styles.plusIcon} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <PlaylistModal
        isOpen={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        selectedTracks={selectedTrack ? [selectedTrack] : []}
        onAddToPlaylist={(playlistId, trackPaths) => { void handleAddTrackToPlaylist(playlistId, trackPaths) }}
      />
    </div>
  )
} 