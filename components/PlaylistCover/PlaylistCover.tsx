'use client'

import React from 'react'
import { ListMusic } from 'lucide-react'
import type { PlaylistTrack } from '@/types/music'
import styles from './PlaylistCover.module.css'

const coverUrl = (coverPath: string): string => `/api/cover/${encodeURIComponent(coverPath)}`

/** One album cover, or a 2×2 mosaic once the playlist spans four or more albums */
export default function PlaylistCover({ tracks, className = '' }: { tracks: PlaylistTrack[]; className?: string }): JSX.Element {
  const covers = Array.from(new Set(tracks.map(t => t.coverPath).filter((c): c is string => Boolean(c))))
  const shown = covers.length >= 4 ? covers.slice(0, 4) : covers.slice(0, 1)
  return (
    <div className={`${styles.cover} ${shown.length === 4 ? styles.mosaic : ''} ${className}`}>
      {shown.length === 0 ? (
        <span className={styles.defaultCover}>
          <ListMusic className={styles.defaultIcon} />
        </span>
      ) : shown.map(c => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={c} src={coverUrl(c)} alt="" className={styles.coverImage} loading="lazy" />
      ))}
    </div>
  )
}
