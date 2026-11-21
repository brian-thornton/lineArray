'use client'

import React, { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Track } from '@/types/music'
import { useSearch } from '@/contexts/SearchContext'
import { useLibrary } from '@/contexts/LibraryContext'
import styles from './page.module.css'
import LibraryLayout from '@/components/LibraryLayout/LibraryLayout'
import ClassicLibraryGrid from '@/components/ClassicLibraryGrid/ClassicLibraryGrid'
import LargeAlbumGrid from '@/components/LargeAlbumGrid/LargeAlbumGrid'
import { useSettings } from '@/contexts/SettingsContext'
import { useAlbumPage } from '@/hooks/useAlbumPage'

// useSearchParams() needs a Suspense boundary. Without one, production builds deopt
// the page and its client-navigation request fails, so every link back to the
// library turns into a full page reload.
export default function Home(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  )
}

function HomeContent(): JSX.Element {
  // const router = useRouter()
  const searchParams = useSearchParams()
  const { searchQuery, searchOpen } = useSearch()
  const { settings } = useSettings()
  const { libraryState, updateLibraryState } = useLibrary()
  const albumsPerClassicPage = 4
  
  // Get page and letter from URL query parameters
  const pageFromUrl = searchParams.get('page')
  const letterFromUrl = searchParams.get('letter')
  const currentPage = pageFromUrl ? parseInt(pageFromUrl, 10) : 1
  const currentLetter = letterFromUrl ?? null
  
  // The library fits the screen without scrolling; search results (shown over it) need to scroll
  const searching = searchOpen || searchQuery !== ''
  useEffect(() => {
    if (!searching) {
      document.body.id = 'library-no-scroll'
    } else {
      document.body.id = ''
    }
    return () => {
      document.body.id = ''
    }
  }, [searching])

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

  const handlePlayTrack = (_track: Track): void => {
    // Track play functionality can be implemented here
  }

  // The classic layout shows a fixed 4 albums a page; the large grid loads its own pages
  const classic = settings.libraryLayout === 'classic'
  const { data: classicPage } = useAlbumPage(libraryState.currentPage, classic ? albumsPerClassicPage : null, null)

  return (
    <LibraryLayout>
      <div className={styles.container}>
        <main className={styles.main}>
          {classic ? (
            <ClassicLibraryGrid
              albums={classicPage?.albums ?? []}
              page={libraryState.currentPage}
              setPage={(page) => updateLibraryState({ currentPage: page })}
              totalPages={classicPage?.totalPages ?? 1}
            />
          ) : (
            <LargeAlbumGrid onPlayTrack={handlePlayTrack} />
          )}
        </main>
      </div>
    </LibraryLayout>
  )
} 