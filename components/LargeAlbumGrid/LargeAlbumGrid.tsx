import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import LargeAlbumCard from '../LargeAlbumCard/LargeAlbumCard'
import SwipeGestures from '../SwipeGestures/SwipeGestures'
import { Track } from '@/types/music'
import { useAlbumPage } from '@/hooks/useAlbumPage'
import { Music, Hash, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLibrary } from '@/contexts/LibraryContext'
import styles from './LargeAlbumGrid.module.css'

interface LargeAlbumGridProps {
  onPlayTrack: (track: Track) => void
}

// The library is loaded one page at a time: only the albums on the current page come from
// the server (see /api/albums), so a large library doesn't have to download all at once.
function LargeAlbumGrid({ onPlayTrack }: LargeAlbumGridProps): JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { libraryState, updateLibraryState } = useLibrary()
  const { selectedLetter, currentPage } = libraryState
  // null until measured; the first page isn't requested before we know how many fit
  const [gridWidth, setGridWidth] = useState<number | null>(null)
  const resizeObserver = useRef<ResizeObserver | null>(null)

  // Columns follow the width the library actually gets (not the window), so it reflows when the
  // Up Next rail docks beside it. 2 rows per page:
  // 6 columns above 1300px, 5 above 1100px, 4 above 900px, otherwise 3
  const columns = useMemo(() => {
    if (gridWidth === null) return null
    if (gridWidth <= 900) return 3
    if (gridWidth <= 1100) return 4
    if (gridWidth <= 1300) return 5
    return 6
  }, [gridWidth])
  const albumsPerPage = columns === null ? null : columns * 2

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    resizeObserver.current?.disconnect()
    resizeObserver.current = null
    if (!el) return
    const update = (): void => setGridWidth(el.getBoundingClientRect().width)
    update()
    resizeObserver.current = new ResizeObserver(update)
    resizeObserver.current.observe(el)
  }, [])

  const { data, isLoading } = useAlbumPage(currentPage, albumsPerPage, selectedLetter)
  const totalPages = data?.totalPages ?? 1
  const currentAlbums = data?.albums ?? []
  const availableLetters = data?.letters ?? []

  // Reset to page 1 if current page is out of bounds after resize
  useEffect(() => {
    if (data && currentPage > totalPages && totalPages > 0) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', '1')
      router.push(`/?${params.toString()}`)
    }
  }, [data, totalPages, currentPage, searchParams, router])

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

  // First load: the container is rendered so its width can be measured for the page size
  if (!data) {
    return (
      <div ref={containerRef} className={styles.container}>
        <div className={styles.loadingContainer}>
          {isLoading && <div className={styles.loadingSpinner} />}
          <p className={styles.loadingText}>{isLoading ? 'Loading…' : 'Could not load the library'}</p>
        </div>
      </div>
    )
  }

  if (data.totalAlbums === 0) {
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

        <div
          className={`${styles.grid} ${isLoading ? styles.gridLoading : ''}`}
          style={{ gridTemplateColumns: `repeat(${columns ?? 5}, minmax(0, 1fr))` }}
          aria-busy={isLoading}
        >
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

      {data.matchingAlbums === 0 && selectedLetter && (
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