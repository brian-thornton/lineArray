import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import LargeAlbumCard from '../LargeAlbumCard/LargeAlbumCard'
import SwipeGestures from '../SwipeGestures/SwipeGestures'
import { Album, Track } from '@/types/music'
import { Music, Hash, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLibrary } from '@/contexts/LibraryContext'
import styles from './LargeAlbumGrid.module.css'

interface LargeAlbumGridProps {
  albums: Album[]
  onPlayTrack: (track: Track) => void
  isLoading: boolean
}

function LargeAlbumGrid({ albums, onPlayTrack, isLoading }: LargeAlbumGridProps): JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { libraryState, updateLibraryState } = useLibrary()
  const { selectedLetter, currentPage } = libraryState
  const [gridWidth, setGridWidth] = useState<number>(1300)
  const resizeObserver = useRef<ResizeObserver | null>(null)

  // Columns follow the width the library actually gets (not the window), so it reflows when the
  // Up Next rail docks beside it. 2 rows per page:
  // 6 columns above 1300px, 5 above 1100px, 4 above 900px, otherwise 3
  const columns = useMemo(() => {
    if (gridWidth <= 900) return 3
    if (gridWidth <= 1100) return 4
    if (gridWidth <= 1300) return 5
    return 6
  }, [gridWidth])
  const albumsPerPage = columns * 2

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    resizeObserver.current?.disconnect()
    resizeObserver.current = null
    if (!el) return
    const update = (): void => setGridWidth(el.getBoundingClientRect().width)
    update()
    resizeObserver.current = new ResizeObserver(update)
    resizeObserver.current.observe(el)
  }, [])

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

  // Reset to page 1 if current page is out of bounds after resize
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', '1')
      router.push(`/?${params.toString()}`)
    }
  }, [totalPages, currentPage, searchParams, router])

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

  // Note: Page reset is now handled through URL navigation in handleLetterClick

  const handleLetterClick = (letter: string): void => {
    const params = new URLSearchParams(searchParams.toString())
    const newLetter = selectedLetter === letter ? null : letter
    if (newLetter) {
      params.set('letter', newLetter)
    } else {
      params.delete('letter')
    }
    params.set('page', '1')
    router.push(`/?${params.toString()}`)
  }

  const handlePreviousPage = (): void => {
    if (currentPage > 1) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', (currentPage - 1).toString())
      router.push(`/?${params.toString()}`)
    }
  }

  const handleNextPage = (): void => {
    if (currentPage < totalPages) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', (currentPage + 1).toString())
      router.push(`/?${params.toString()}`)
    }
  }

  const handleSwipeLeft = (): void => {
    handleNextPage()
  }

  const handleSwipeRight = (): void => {
    handlePreviousPage()
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
    <SwipeGestures
      onSwipeLeft={handleSwipeLeft}
      onSwipeRight={handleSwipeRight}
      disabled={totalPages <= 1}
    >
      <div ref={containerRef} className={styles.container}>
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

        {/* Mobile pagination bar — hidden on desktop via CSS */}
        {totalPages > 1 && (
          <div className={styles.mobilePagination}>
            <button
              className={styles.mobilePagBtn}
              onClick={handlePreviousPage}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={20} />
              Prev
            </button>
            <span className={styles.mobilePagInfo}>
              {currentPage} / {totalPages}
            </span>
            <button
              className={styles.mobilePagBtn}
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
            >
              Next
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
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



      {/* iOS-style floating letter index — mobile only, hidden on desktop via CSS */}
      <div className={styles.mobileLetterIndex} aria-label="Jump to letter">
        <button
          className={`${styles.mobileLetterIndexBtn} ${!selectedLetter ? styles.mobileLetterIndexActive : ''}`}
          onClick={() => { updateLibraryState({ selectedLetter: null }) }}
          aria-label="Show all albums"
        >
          ★
        </button>
        <button
          className={`${styles.mobileLetterIndexBtn} ${selectedLetter === '#' ? styles.mobileLetterIndexActive : ''} ${!availableLetters.includes('#') ? styles.mobileLetterIndexUnavailable : ''}`}
          onClick={() => { if (availableLetters.includes('#')) handleLetterClick('#') }}
          aria-label="Albums starting with numbers"
        >
          #
        </button>
        {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map((letter) => (
          <button
            key={letter}
            className={`${styles.mobileLetterIndexBtn} ${selectedLetter === letter ? styles.mobileLetterIndexActive : ''} ${!availableLetters.includes(letter) ? styles.mobileLetterIndexUnavailable : ''}`}
            onClick={() => { if (availableLetters.includes(letter)) handleLetterClick(letter) }}
            aria-label={`Albums starting with ${letter}`}
          >
            {letter}
          </button>
        ))}
      </div>

      {/* Letter Navigation Bar */}
      <div className={styles.letterNav}>
        <button
          className={`${styles.letterButton} ${!selectedLetter ? styles.active : ''}`}
                          onClick={() => updateLibraryState({ selectedLetter: null })}
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


      </div>
      </div>
    </SwipeGestures>
  )
}

export default LargeAlbumGrid 