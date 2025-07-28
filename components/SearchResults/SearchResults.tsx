'use client'

import React, { useState, useEffect } from 'react'
import PlaylistModal from '../PlaylistModal/PlaylistModal'
import { useSettings } from '@/contexts/SettingsContext'
import SearchResultItem from './SearchResultItem'
import styles from './SearchResults.module.css'
import { SearchResult } from './types'

interface SearchResultsProps {
  results: SearchResult[]
  onTrackClick: (path: string) => void
  isLoading: boolean
}

const MIN_PAGE_SIZE = 5
const MAX_PAGE_SIZE = 50

export default function SearchResults({ results, onTrackClick, isLoading }: SearchResultsProps): JSX.Element {
  const { canPerformAction } = useSettings()
  const [showPlaylistModal, setShowPlaylistModal] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Dynamically calculate page size based on viewport height
  useEffect(() => {
    function updatePageSize(): void {
      // More conservative height estimates to prevent scrolling
      const headerHeight = 120 // Increased from 80
      const paginationHeight = 80 // Increased from 60
      const padding = 80 // Increased from 48
      const searchBoxHeight = 60 // Account for search box
      const safetyMargin = 40 // Extra safety margin
      
      // Estimate per-result height (mobile/desktop)
      let resultHeight = 72
      if (window.innerWidth >= 1024 && window.matchMedia('(pointer: coarse)').matches) {
        resultHeight = 80
      } else if (window.innerWidth > 768) {
        resultHeight = 64
      }
      
      const totalReserved = headerHeight + paginationHeight + padding + searchBoxHeight + safetyMargin
      const available = window.innerHeight - totalReserved
      const fit = Math.floor(available / resultHeight)
      setPageSize(Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, fit)))
    }
    updatePageSize()
    window.addEventListener('resize', updatePageSize)
    return () => window.removeEventListener('resize', updatePageSize)
  }, [])

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize))
  const pagedResults = results.slice((page - 1) * pageSize, page * pageSize)

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
        {pagedResults.map((result) => (
          <SearchResultItem
            key={result.id}
            result={result}
            onTrackClick={onTrackClick}
            onAddToPlaylist={handleAddToPlaylist}
          />
        ))}
      </div>
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageButton}
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            Prev
          </button>
          <span className={styles.pageInfo}>
            Page {page} of {totalPages}
          </span>
          <button
            className={styles.pageButton}
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      )}
      <PlaylistModal
        isOpen={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        selectedTracks={selectedTrack ? [selectedTrack] : []}
        onAddToPlaylist={(playlistId, trackPaths) => { void handleAddTrackToPlaylist(playlistId, trackPaths) }}
      />
    </div>
  )
} 