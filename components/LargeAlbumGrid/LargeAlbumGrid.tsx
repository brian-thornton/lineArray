import React, { useState, useMemo, useEffect } from 'react'
import LargeAlbumCard from '../LargeAlbumCard/LargeAlbumCard'
import { Album, Track } from '@/types/music'
import { Music, Hash, Folder, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './LargeAlbumGrid.module.css'

interface LargeAlbumGridProps {
  albums: Album[]
  onPlayTrack: (track: Track) => void
  isLoading: boolean
}

function LargeAlbumGrid({ albums, onPlayTrack, isLoading }: LargeAlbumGridProps): JSX.Element {
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const albumsPerPage = 12 // 6x2 grid as shown in screenshot

  // Filter albums based on selected letter
  const filteredAlbums = useMemo(() => {
    if (!selectedLetter) return albums
    
    return albums.filter(album => {
      const firstChar = album.title.charAt(0).toUpperCase()
      if (selectedLetter === '#') {
        return /[0-9]/.test(firstChar)
      }
      if (selectedLetter === '~') {
        return /[^A-Z0-9]/.test(firstChar)
      }
      return firstChar === selectedLetter
    })
  }, [albums, selectedLetter])

  // Calculate pagination
  const totalPages = Math.ceil(filteredAlbums.length / albumsPerPage)
  const startIndex = (currentPage - 1) * albumsPerPage
  const endIndex = startIndex + albumsPerPage
  const currentAlbums = filteredAlbums.slice(startIndex, endIndex)

  // Generate available letters from albums
  const availableLetters = useMemo(() => {
    const letters = new Set<string>()
    
    albums.forEach(album => {
      const firstChar = album.title.charAt(0).toUpperCase()
      if (/[0-9]/.test(firstChar)) {
        letters.add('#')
      } else if (/[^A-Z0-9]/.test(firstChar)) {
        letters.add('~')
      } else if (/[A-Z]/.test(firstChar)) {
        letters.add(firstChar)
      }
    })
    
    return Array.from(letters).sort()
  }, [albums])

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedLetter, albums.length])

  const handleLetterClick = (letter: string): void => {
    setSelectedLetter(selectedLetter === letter ? null : letter)
  }

  const handlePreviousPage = (): void => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = (): void => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <p className={styles.loadingText}>Loading…</p>
      </div>
    )
  }

  if (albums.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>🎵</div>
        <h3 className={styles.emptyTitle}>No Albums Found</h3>
        <p className={styles.emptyText}>
          Scan your music library to discover your albums
        </p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Pagination Info */}
      <div className={styles.paginationInfo}>
        <span className={styles.pageInfo}>
          {filteredAlbums.length > 0 ? `${startIndex + 1}-${Math.min(endIndex, filteredAlbums.length)}` : '0'} of {filteredAlbums.length} albums
        </span>
      </div>

      {/* Album Grid */}
      <div className={styles.gridContainer}>
        {/* Left Navigation Arrow */}
        {totalPages > 1 && currentPage > 1 && (
          <button
            className={`${styles.navArrow} ${styles.navArrowLeft}`}
            onClick={handlePreviousPage}
            aria-label="Previous page"
            title="Previous page"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* Right Navigation Arrow */}
        {totalPages > 1 && currentPage < totalPages && (
          <button
            className={`${styles.navArrow} ${styles.navArrowRight}`}
            onClick={handleNextPage}
            aria-label="Next page"
            title="Next page"
          >
            <ChevronRight size={24} />
          </button>
        )}

        <div className={styles.grid}>
          {currentAlbums.map((album) => (
            <LargeAlbumCard
              key={album.id}
              album={album}
              onPlayTrack={onPlayTrack}
              isSelected={false}
            />
          ))}
        </div>
      </div>

      {filteredAlbums.length === 0 && selectedLetter && (
        <div className={styles.noResults}>
          <p>No albums found starting with &quot;{selectedLetter}&quot;</p>
        </div>
      )}

      {/* Currently Playing Queue */}
      <div className={styles.queueSection}>
        <div className={styles.queueTitle}>Currently Playing</div>
        <div className={styles.queueItems}>
          {/* Placeholder queue items - you can replace with actual queue data */}
          <div className={styles.queueItem}>
            <div className={styles.queueCover} />
            <div className={styles.queueInfo}>
              <div className={styles.queueTrack}>Hung Up</div>
              <div className={styles.queueArtist}>Madonna</div>
              <div className={styles.queueDuration}>02:04</div>
            </div>
          </div>
          <div className={styles.queueItem}>
            <div className={styles.queueCover} />
            <div className={styles.queueInfo}>
              <div className={styles.queueTrack}>Circus</div>
              <div className={styles.queueArtist}>Britney Spears</div>
              <div className={styles.queueDuration}>00:27</div>
            </div>
          </div>
          <div className={styles.queueItem}>
            <div className={styles.queueCover} />
            <div className={styles.queueInfo}>
              <div className={styles.queueTrack}>Axel F</div>
              <div className={styles.queueArtist}>Crazy Frog</div>
              <div className={styles.queueDuration}>02:11</div>
            </div>
          </div>
        </div>
      </div>

      {/* Letter Navigation Bar */}
      <div className={styles.letterNav}>
        <button
          className={`${styles.letterButton} ${!selectedLetter ? styles.active : ''}`}
          onClick={() => setSelectedLetter(null)}
          aria-label="Show all albums"
        >
          <Music size={16} />
        </button>
        
        <button
          className={`${styles.letterButton} ${selectedLetter === '#' ? styles.active : ''}`}
          onClick={() => handleLetterClick('#')}
          aria-label="Albums starting with numbers"
        >
          <Hash size={16} />
        </button>

        {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map((letter) => (
          <button
            key={letter}
            className={`${styles.letterButton} ${
              selectedLetter === letter ? styles.active : ''
            } ${availableLetters.includes(letter) ? styles.available : styles.unavailable}`}
            onClick={() => handleLetterClick(letter)}
            disabled={!availableLetters.includes(letter)}
            aria-label={`Albums starting with ${letter}`}
          >
            {letter}
          </button>
        ))}

        <button
          className={`${styles.letterButton} ${selectedLetter === '~' ? styles.active : ''}`}
          onClick={() => handleLetterClick('~')}
          aria-label="Albums starting with symbols"
        >
          <Folder size={16} />
        </button>

        <button
          className={styles.letterButton}
          aria-label="Playlist"
        >
          <FileText size={16} />
        </button>
      </div>
    </div>
  )
}

export default LargeAlbumGrid 