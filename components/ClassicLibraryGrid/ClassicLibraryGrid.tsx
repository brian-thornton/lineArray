import React from 'react';
import { Album } from '@/types/music';
import styles from './ClassicLibraryGrid.module.css';
import Image from 'next/image';
import { Music } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

interface ClassicLibraryGridProps {
  albums: Album[];
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
}

export default function ClassicLibraryGrid({ albums, page, totalPages }: ClassicLibraryGridProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (
    <div className={styles.classicGridWrapper}>
      <div className={styles.gridNavWrapper}>
        {totalPages > 1 && page > 1 && (
          <button
            className={`${styles.navArrow} ${styles.navArrowLeft}`}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString())
              params.set('page', (page - 1).toString())
              router.push(`/?${params.toString()}`)
            }}
            aria-label="Previous page"
            title="Previous page"
          >
            &#60;
          </button>
        )}
        <div className={styles.grid}>
          {albums.map((album) => (
            <div
              className={styles.albumBox}
              key={album.id}
              onClick={() => router.push(`/album/${album.id}`)}
              role="button"
              tabIndex={0}
              aria-label={`View details for ${album.title}`}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') router.push(`/album/${album.id}`) }}
            >
              <div className={styles.albumTitle}>{album.title}</div>
              <div className={styles.contentRow}>
                <div className={styles.coverRow}>
                  {album.coverPath ? (
                    <Image
                      src={`/api/cover/${encodeURIComponent(album.coverPath)}`}
                      alt={album.title}
                      className={styles.cover}
                      width={240}
                      height={240}
                      unoptimized
                    />
                  ) : (
                    <div className={styles.defaultCover}>
                      <Music className={styles.defaultIcon} />
                    </div>
                  )}
                </div>
                <div className={styles.rightColumn}>
                  <div className={styles.tracksList}>
                    <ol>
                      {album.tracks.slice(0, 10).map((track, tIdx) => (
                        <li key={track.id} className={styles.trackItem}>
                          <span className={styles.trackNumber}>{(track.trackNumber ?? tIdx + 1).toString().padStart(2, '0')}</span>
                          {' - '}
                          <span className={styles.trackTitle}>{track.title}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {totalPages > 1 && page < totalPages && (
          <button
            className={`${styles.navArrow} ${styles.navArrowRight}`}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString())
              params.set('page', (page + 1).toString())
              router.push(`/?${params.toString()}`)
            }}
            aria-label="Next page"
            title="Next page"
          >
            &#62;
          </button>
        )}
      </div>
    </div>
  );
} 