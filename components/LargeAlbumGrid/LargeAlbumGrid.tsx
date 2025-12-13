import React, { useMemo, useState, useEffect } from 'react'
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
  const [viewportWidth, setViewportWidth] = useState<number>(1300)
  
  // Calculate albums per page based on viewport width
  // 6 columns x 2 rows = 12 items for widths > 1300px
  // 5 columns x 2 rows = 10 items for widths <= 1300px and > 1100px
  // 4 columns x 2 rows = 8 items for widths <= 1100px and > 900px
  // 3 columns x 2 rows = 6 items for widths <= 900px
  const albumsPerPage = useMemo(() => {
    let columns = 6
    if (viewportWidth <= 900) {
      columns = 3
    } else if (viewportWidth <= 1100) {
      columns = 4
    } else if (viewportWidth <= 1300) {
      columns = 5
    }
    const rows = 2
    return columns * rows
  }, [viewportWidth])

  // Update viewport width on mount and resize
  useEffect(() => {
    const updateViewportWidth = (): void => {
      if (typeof window !== 'undefined') {
        setViewportWidth(window.innerWidth)
      }
    }

    updateViewportWidth()
    window.addEventListener('resize', updateViewportWidth)
    return () => window.removeEventListener('resize', updateViewportWidth)
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
      <div className={styles.container}>
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