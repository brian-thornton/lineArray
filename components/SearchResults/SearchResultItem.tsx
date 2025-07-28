'use client'

import React from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import styles from './SearchResults.module.css'
import { SearchResult } from './types'

interface SearchResultItemProps {
  result: SearchResult
  onTrackClick: (path: string) => void
  onAddToPlaylist: (e: React.MouseEvent, trackPath: string) => void
}

export default function SearchResultItem({ result, onTrackClick, onAddToPlaylist }: SearchResultItemProps): JSX.Element {
  const { canPerformAction } = useSettings()

  const handleTrackClick = (e: React.MouseEvent, path: string): void => {
    e.preventDefault()
    if (!canPerformAction('allowAddToQueue')) {
      console.error('Adding to queue is restricted in party mode')
      return
    }
    onTrackClick(path)
  }

  if (result.type === 'album') {
    return (
      <div className={styles.resultItem}>
        <Link href={`/album/${result.id}`} className={styles.albumResult}>
          <div className={styles.resultIcon}>📀</div>
          <div className={styles.resultContent}>
            <div className={styles.resultTitle}>{result.title}</div>
            <div className={styles.resultType}>Album</div>
          </div>
        </Link>
      </div>
    )
  }

  return (
    <div className={styles.resultItem}>
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
              onClick={(e) => onAddToPlaylist(e, result.path as string)}
              className={styles.addToPlaylistButton}
              disabled={!canPerformAction('allowCreatePlaylists')}
              title={!canPerformAction('allowCreatePlaylists') ? 'Creating playlists is restricted in party mode' : 'Add to Playlist'}
            >
              <Plus className={styles.plusIcon} />
            </button>
          </>
        )}
      </div>
    </div>
  )
} 