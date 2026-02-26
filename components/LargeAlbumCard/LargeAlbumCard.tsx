import React from 'react'
import { useRouter } from 'next/navigation'
import { Album, Track } from '@/types/music'
import { usePlayer } from '@/contexts/PlayerContext'
import styles from './LargeAlbumCard.module.css'

interface LargeAlbumCardProps {
  album: Album
  onPlayTrack: (track: Track) => void
  isSelected: boolean
}

function LargeAlbumCard({ album, onPlayTrack: _onPlayTrack, isSelected }: LargeAlbumCardProps): JSX.Element {
  const router = useRouter()
  const { currentTrackPath } = usePlayer()
  const isNowPlaying = currentTrackPath !== null &&
    album.tracks.some(t => t.path === currentTrackPath)

  const handleClick = (): void => {
    router.push(`/album/${album.id}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <div 
      className={`${styles.card} ${isSelected ? styles.selected : ''} ${isNowPlaying ? styles.nowPlaying : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`View ${album.title} details`}
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