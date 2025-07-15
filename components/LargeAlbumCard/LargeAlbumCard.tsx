import React from 'react'
import { Album, Track } from '@/types/music'
import styles from './LargeAlbumCard.module.css'

interface LargeAlbumCardProps {
  album: Album
  onPlayTrack: (track: Track) => void
  isSelected: boolean
}

function LargeAlbumCard({ album, onPlayTrack, isSelected }: LargeAlbumCardProps): JSX.Element {
  const handleClick = (): void => {
    if (album.tracks.length > 0) {
      onPlayTrack(album.tracks[0])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <div 
      className={`${styles.card} ${isSelected ? styles.selected : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Play ${album.title}`}
    >
      <div className={styles.coverContainer}>
        <div className={styles.reflectiveFrame}>
          {album.coverPath ? (
            <img 
              src={`/api/cover/${encodeURIComponent(album.coverPath)}`}
              alt={`${album.title} cover`}
              className={styles.cover}
            />
          ) : (
            <div className={styles.placeholderCover}>
              <div className={styles.placeholderIcon}>🎵</div>
            </div>
          )}
        </div>
      </div>
      
      <div className={styles.info}>
        <div className={styles.title}>{album.title}</div>
        {album.year && <div className={styles.year}>{album.year}</div>}
      </div>
    </div>
  )
}

export default LargeAlbumCard 