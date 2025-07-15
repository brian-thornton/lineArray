'use client'

import React, { useState, useEffect } from 'react'
import { Album, Track } from '@/types/music'
import AlbumGrid from '@/components/AlbumGrid/AlbumGrid'
import SearchResults from '@/components/SearchResults/SearchResults'
import { useSearch } from '@/contexts/SearchContext'
import { useToast } from '@/contexts/ToastContext'
import styles from './page.module.css'
import LibraryLayout from '@/components/LibraryLayout/LibraryLayout'
import ClassicLibraryGrid from '@/components/ClassicLibraryGrid/ClassicLibraryGrid'
import { useSettings } from '@/contexts/SettingsContext'

interface WindowWithPlayer extends Window {
  hasAddedTrackToQueue?: boolean
  checkPlayerStatusImmediately?: () => Promise<void>
}

export default function Home(): JSX.Element {
  const { searchQuery, searchResults, isSearching, addTrackToQueue, hideKeyboard } = useSearch()
  const { showToast } = useToast()
  const { settings } = useSettings()
  const [albums, setAlbums] = useState<Album[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [classicPage, setClassicPage] = useState(1)
  const albumsPerClassicPage = 4

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

  const totalClassicPages = Math.max(1, Math.ceil(albums.length / albumsPerClassicPage))
  const pagedClassicAlbums = albums.slice((classicPage - 1) * albumsPerClassicPage, classicPage * albumsPerClassicPage)

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
            {settings.libraryLayout === 'classic' ? (
              <ClassicLibraryGrid
                albums={pagedClassicAlbums}
                page={classicPage}
                setPage={setClassicPage}
                totalPages={totalClassicPages}
              />
            ) : (
              <AlbumGrid 
                albums={albums}
                onPlayTrack={handlePlayTrack}
                isLoading={isLoading}
              />
            )}
          </main>
        </div>
      </LibraryLayout>
    )
  )
} 