'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Plus, Disc3, Music } from 'lucide-react'
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
  const [flashing, setFlashing] = useState(false)
  const [albumImgError, setAlbumImgError] = useState(false)
  const [trackImgError, setTrackImgError] = useState(false)

  const handleTrackClick = (e: React.MouseEvent, path: string): void => {
    e.preventDefault()
    if (!canPerformAction('allowAddToQueue')) {
      console.error('Adding to queue is restricted in party mode')
      return
    }
    setFlashing(true)
    setTimeout(() => setFlashing(false), 600)
    onTrackClick(path)
  }

  if (result.type === 'album') {
    const albumCoverUrl = result.coverPath && !albumImgError
      ? `/api/cover/${encodeURIComponent(result.coverPath)}`
      : null

    return (
      <div className={styles.resultItem}>
        <Link href={`/album/${result.id}`} className={styles.albumResult}>
          <div className={styles.resultThumb}>
            {albumCoverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={albumCoverUrl}
                alt={result.title}
                className={styles.thumbImg}
                onError={() => setAlbumImgError(true)}
              />
            ) : (
              <Disc3 size={24} className={styles.thumbIcon} />
            )}
          </div>
          <div className={styles.resultContent}>
            <div className={styles.resultTitle}>{result.title}</div>
            <div className={styles.resultType}>Album</div>
          </div>
        </Link>
      </div>
    )
  }

  const trackCoverUrl = result.path && !trackImgError
    ? `/api/cover-for-track?path=${encodeURIComponent(result.path)}`
    : null

  return (
    <div className={`${styles.resultItem} ${flashing ? styles.trackFlash : ''}`}>
      <div className={styles.trackResultContainer}>
        {result.path && (
          <>
            <button
              onClick={(e) => handleTrackClick(e, result.path as string)}
              className={styles.trackResult}
              disabled={!canPerformAction('allowAddToQueue')}
              title={!canPerformAction('allowAddToQueue') ? 'Adding to queue is restricted in party mode' : 'Play track'}
            >
              <div className={styles.resultThumb}>
                {trackCoverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={trackCoverUrl}
                    alt=""
                    className={styles.thumbImg}
                    onError={() => setTrackImgError(true)}
                  />
                ) : (
                  <Music size={24} className={styles.thumbIcon} />
                )}
              </div>
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