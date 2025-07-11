'use client'

import React, { useState, useEffect } from 'react'
import { Album, Track } from '@/types/music'
import AlbumGrid from '@/components/AlbumGrid'
import SearchResults from '@/components/SearchResults'
import { useSearch } from '@/contexts/SearchContext'
import { useToast } from '@/contexts/ToastContext'
import styles from './page.module.css'
import LibraryLayout from '@/components/LibraryLayout/LibraryLayout'

interface WindowWithPlayer extends Window {
  hasAddedTrackToQueue?: boolean
  checkPlayerStatusImmediately?: () => Promise<void>
}

export default function Home(): JSX.Element {
  const { searchQuery, searchResults, isSearching, addTrackToQueue, hideKeyboard } = useSearch()
  const { showToast } = useToast()
  const [albums, setAlbums] = useState<Album[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!searchQuery) {
      document.body.id = 'library-no-scroll'
    } else {
      document.body.id = ''
    }
    return () => {
      document.body.id = ''
    }
  }, [searchQuery])

  useEffect(() => {
    void loadAlbums()
  }, [])

  const loadAlbums = async (): Promise<void> => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/albums')
      if (response.ok) {
        const data = await response.json() as { albums: Album[]; scanPaths: string[]; scanResults: { [path: string]: { albums: number; files: number; lastScanned: string } } }
        setAlbums(data.albums || [])
      }
    } catch (error) {
      console.error('Error loading albums:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePlayTrack = (_track: Track): void => {
    // Track play functionality can be implemented here
  }

  const handleTrackClick = async (path: string): Promise<void> => {
    await addTrackToQueue(path)
    hideKeyboard()
    
    // Find the track title for the toast
    const track = searchResults.find(result => result.path === path)
    if (track) {
      showToast(`Added "${track.title}" to queue`, 'success')
    }
    
    // Set flag to show player controls
    if (typeof window !== 'undefined') {
      (window as WindowWithPlayer).hasAddedTrackToQueue = true
    }
    
    // Immediately check player status to show controls faster
    if (typeof window !== 'undefined' && (window as WindowWithPlayer).checkPlayerStatusImmediately) {
      setTimeout(() => {
        void (window as WindowWithPlayer).checkPlayerStatusImmediately?.()
      }, 100)
    }
  }

  return (
    searchQuery ? (
      <div className={styles.container}>
        <main className={styles.main}>
          <SearchResults 
            results={searchResults}
            onTrackClick={path => { void handleTrackClick(path); }}
            isLoading={isSearching}
          />
        </main>
      </div>
    ) : (
      <LibraryLayout>
        <div className={styles.container}>
          <main className={styles.main}>
            <AlbumGrid 
              albums={albums}
              onPlayTrack={handlePlayTrack}
              isLoading={isLoading}
            />
          </main>
        </div>
      </LibraryLayout>
    )
  )
} 