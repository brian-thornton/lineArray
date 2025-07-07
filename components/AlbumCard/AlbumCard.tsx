import React from 'react'
import { useRouter } from 'next/navigation'
import { Music } from 'lucide-react'
import { Album, Track } from '@/types/music'
import styles from './AlbumCard.module.css'
import Image from 'next/image'

interface AlbumCardProps {
  album: Album
  onPlayTrack: (track: Track) => void
  isSelected: boolean
}

function AlbumCard({ album, onPlayTrack: _onPlayTrack, isSelected }: AlbumCardProps): JSX.Element {
  const router = useRouter()

  const handleCardClick = (): void => {
    router.push(`/album/${album.id}`)
  }

  // Generate cover URL using the API endpoint
  const getCoverUrl = (coverPath: string | undefined): string | undefined => {
    if (!coverPath) return undefined
    return `/api/cover/${encodeURIComponent(coverPath)}`
  }

  return (
    <div 
      className={`${styles.card} ${isSelected ? styles.selected : ''}`}
      onClick={handleCardClick}
      tabIndex={0}
      role="button"
      aria-label={`View details for ${album.title}`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleCardClick() }}
    >
      <div className={styles.header}>
        <div className={styles.cover}>
          {album.coverPath ? (
            <Image
              src={getCoverUrl(album.coverPath) ?? ''}
              alt={`${album.title} cover`}
              className={styles.coverImage}
              width={128}
              height={128}
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
          <h3 className={styles.title}>{album.title}</h3>
          {album.year && <p className={styles.year}>{album.year}</p>}
        </div>
      </div>
    </div>
  )
}

export default AlbumCard 