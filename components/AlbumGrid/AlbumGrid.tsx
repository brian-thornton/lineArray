import React, { useState, useMemo, useEffect } from 'react'
import AlbumCard from '../AlbumCard'
import Pagination from '../Pagination'
import { Album, Track } from '@/types/music'
import styles from './AlbumGrid.module.css'

interface AlbumGridProps {
  albums: Album[]
  onPlayTrack: (track: Track) => void
  isLoading: boolean
  itemsPerPage?: number
}

const AlbumGrid: React.FC<AlbumGridProps> = ({ 
  albums, 
  onPlayTrack, 
  isLoading, 
  itemsPerPage = 12 
}) => {
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [gridConfig, setGridConfig] = useState({
    columnsPerRow: 4,
    itemsPerPage: 12
  })

  // Calculate optimal grid layout based on viewport size
  useEffect(() => {
    const calculateGridLayout = () => {
      if (typeof window === 'undefined') return

      const viewportWidth = window.innerWidth
      
      // Responsive layout based on screen size
      let columnsPerRow = 7 // Default for desktop
      if (viewportWidth <= 1366) { // Tablet size
        columnsPerRow = 6
      }
      
      const rowsPerPage = 3 // Always 3 rows
      const itemsPerPage = columnsPerRow * rowsPerPage
      
      setGridConfig({
        columnsPerRow,
        itemsPerPage
      })
    }

    calculateGridLayout()
    
    const handleResize = () => {
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

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Scroll to top of grid
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Generate dynamic CSS for grid columns
  const gridStyle = useMemo(() => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${gridConfig.columnsPerRow}, 1fr)`,
    gap: 'var(--spacing-lg)',
    width: '100%',
    flex: 1,
    overflowY: 'auto' as const,
    paddingBottom: 'var(--spacing-md)'
  }), [gridConfig.columnsPerRow])

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p className={styles.loadingText}>Scanning your music library...</p>
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
      <div 
        style={gridStyle}
      >
        {currentAlbums.map((album) => (
          <AlbumCard
            key={album.id}
            album={album}
            onPlayTrack={onPlayTrack}
            isSelected={selectedAlbum?.id === album.id}
            onSelect={() => setSelectedAlbum(selectedAlbum?.id === album.id ? null : album)}
          />
        ))}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        totalItems={albums.length}
        itemsPerPage={gridConfig.itemsPerPage}
      />
    </div>
  )
}

export default AlbumGrid 