'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Album, Track } from '@/types/music'
import AlbumGrid from '@/components/AlbumGrid/AlbumGrid'
import SearchResults from '@/components/SearchResults/SearchResults'
import { useSearch } from '@/contexts/SearchContext'
import { useToast } from '@/contexts/ToastContext'
import { useLibrary } from '@/contexts/LibraryContext'
import styles from './page.module.css'
import LibraryLayout from '@/components/LibraryLayout/LibraryLayout'
import ClassicLibraryGrid from '@/components/ClassicLibraryGrid/ClassicLibraryGrid'
import LargeAlbumGrid from '@/components/LargeAlbumGrid/LargeAlbumGrid'
import { useSettings } from '@/contexts/SettingsContext'

interface WindowWithPlayer extends Window {
  hasAddedTrackToQueue?: boolean
  checkPlayerStatusImmediately?: () => Promise<void>
}

export default function Home(): JSX.Element {
  // const router = useRouter()
  const searchParams = useSearchParams()
  const { searchQuery, searchResults, isSearching, addTrackToQueue, hideKeyboard } = useSearch()
  const { showToast } = useToast()
  const { settings } = useSettings()
  const { libraryState, updateLibraryState } = useLibrary()
  const [albums, setAlbums] = useState<Album[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const albumsPerClassicPage = 4
  
  // Get page and letter from URL query parameters
  const pageFromUrl = searchParams.get('page')
  const letterFromUrl = searchParams.get('letter')
  const currentPage = pageFromUrl ? parseInt(pageFromUrl, 10) : 1
  const currentLetter = letterFromUrl ?? null
  
  console.log('Current layout setting:', settings.libraryLayout)
  
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

  // Update library state with page and letter from URL
  useEffect(() => {
    const updates: Partial<{ currentPage: number; selectedLetter: string | null }> = {}
    
    if (currentPage !== libraryState.currentPage) {
      updates.currentPage = currentPage
    }
    
    if (currentLetter !== libraryState.selectedLetter) {
      updates.selectedLetter = currentLetter
    }
    
    if (Object.keys(updates).length > 0) {
      updateLibraryState(updates)
    }
  }, [currentPage, currentLetter, libraryState.currentPage, libraryState.selectedLetter, updateLibraryState])

  // Only update layout if it's the default layout and settings has a different preference
  useEffect(() => {
    if (libraryState.layout === 'modern' && settings.libraryLayout !== 'modern' && !isLoading) {
      updateLibraryState({ layout: settings.libraryLayout })
    }
  }, [settings.libraryLayout, libraryState.layout, updateLibraryState, isLoading])

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
  const pagedClassicAlbums = albums.slice((libraryState.currentPage - 1) * albumsPerClassicPage, libraryState.currentPage * albumsPerClassicPage)

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
                page={libraryState.currentPage}
                setPage={(page) => updateLibraryState({ currentPage: page })}
                totalPages={totalClassicPages}
              />
            ) : settings.libraryLayout === 'large' ? (
              <LargeAlbumGrid 
                albums={albums}
                onPlayTrack={handlePlayTrack}
                isLoading={isLoading}
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