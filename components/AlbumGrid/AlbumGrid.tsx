import React, { useState, useMemo, useEffect } from 'react'
import AlbumCard from '../AlbumCard'
import Pagination from '../Pagination'
import SwipeGestures from '../SwipeGestures'
import { Album, Track } from '@/types/music'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import styles from './AlbumGrid.module.css'

interface AlbumGridProps {
  albums: Album[]
  onPlayTrack: (track: Track) => void
  isLoading: boolean
}

function AlbumGrid({ albums, onPlayTrack, isLoading }: AlbumGridProps): JSX.Element {
  const { settings } = useSettings()
  const [currentPage, setCurrentPage] = useState(1)
  const [gridConfig, setGridConfig] = useState({
    columnsPerRow: 4,
    itemsPerPage: 12
  })

  // Calculate optimal grid layout based on viewport size
  useEffect(() => {
    const calculateGridLayout = (): void => {
      if (typeof window === 'undefined') return

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      // Responsive layout based on screen size - more columns for compact layout
      let columnsPerRow = 9 // Default for extra large desktop (1366px+)
      if (viewportWidth <= 1366) { // Large desktop
        columnsPerRow = 8
      }
      if (viewportWidth <= 1200) { // Medium desktop
        columnsPerRow = 7
      }
      if (viewportWidth <= 1024) { // Desktop
        columnsPerRow = 6
      }
      if (viewportWidth <= 768) { // Tablet
        columnsPerRow = 4
      }
      if (viewportWidth <= 480) { // Mobile
        columnsPerRow = 3
      }
      
      // Calculate rows based on viewport height
      // Account for header, padding, and pagination
      let headerHeight = 80 // Approximate header height
      let padding = 80 // Top and bottom padding
      let paginationHeight = 60 // Pagination height
      let albumCardHeight = 200 // Approximate height of album card + gap
      
      // Adjust for mobile
      if (viewportWidth <= 480) {
        headerHeight = 60 // Smaller header on mobile
        padding = 40 // Less padding on mobile
        paginationHeight = 40 // Smaller pagination on mobile
        albumCardHeight = 140 // Adjusted for exactly 2 rows on mobile
        // Force exactly 2 rows on mobile
        const rowsPerPage = 2
        const itemsPerPage = columnsPerRow * rowsPerPage
        
        setGridConfig({
          columnsPerRow,
          itemsPerPage
        })
        return
      } else if (viewportWidth <= 768) {
        headerHeight = 70
        padding = 60
        paginationHeight = 50
        albumCardHeight = 160 // Medium album cards on tablet
      }
      
      const availableHeight = viewportHeight - headerHeight - padding - paginationHeight
      const rowsPerPage = Math.max(2, Math.floor(availableHeight / albumCardHeight)) // Ensure at least 2 rows
      
      const itemsPerPage = columnsPerRow * rowsPerPage
      
      setGridConfig({
        columnsPerRow,
        itemsPerPage
      })
    }

    calculateGridLayout()
    
    const handleResize = (): void => {
      calculateGridLayout()
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Calculate pagination using dynamic items per page
  const totalPages = Math.ceil(albums.length / gridConfig.itemsPerPage)
  const startIndex = (currentPage - 1) * gridConfig.itemsPerPage
  const endIndex = startIndex + gridConfig.itemsPerPage
  const currentAlbums = albums.slice(startIndex, endIndex)

  // Reset to first page when albums change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [albums.length])

  const handlePageChange = (page: number): void => {
    setCurrentPage(page)
    // Scroll to top of grid
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSwipeLeft = (): void => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1)
    }
  }

  const handleSwipeRight = (): void => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1)
    }
  }

  const handlePreviousPage = (): void => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1)
    }
  }

  const handleNextPage = (): void => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1)
    }
  }

  // Generate dynamic CSS for grid columns
  const gridStyle = useMemo(() => ({
    gridTemplateColumns: `repeat(${gridConfig.columnsPerRow}, 1fr)`,
  }), [gridConfig.columnsPerRow])

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

        <div 
          className={styles.gridContainer}
          style={gridStyle}
        >
          {currentAlbums.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              onPlayTrack={onPlayTrack}
              isSelected={false}
            />
          ))}
        </div>

        {settings.showPagination && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            totalItems={albums.length}
            itemsPerPage={gridConfig.itemsPerPage}
          />
        )}
      </div>
    </SwipeGestures>
  )
}

export default AlbumGrid 