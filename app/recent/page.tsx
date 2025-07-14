'use client'

import React from 'react'
import RecentlyPlayed from '@/components/RecentlyPlayed/RecentlyPlayed'
import SearchResults from '@/components/SearchResults/SearchResults'
import { useSearch } from '@/contexts/SearchContext'
import { useToast } from '@/contexts/ToastContext'
import styles from './page.module.css'

export default function RecentPage(): JSX.Element {
  const { searchQuery, searchResults, isSearching, addTrackToQueue, hideKeyboard } = useSearch()
  const { showToast } = useToast()

  const handleTrackClick = async (path: string): Promise<void> => {
    await addTrackToQueue(path)
    hideKeyboard()
    
    // Find the track title for the toast
    const track = searchResults.find(result => result.path === path)
    if (track) {
      showToast(`Added "${track.title}" to queue`, 'success')
    }
  }

  return (
    searchQuery ? (
      <div className={styles.container}>
        <SearchResults 
          results={searchResults}
          onTrackClick={path => { void handleTrackClick(path); }}
          isLoading={isSearching}
        />
      </div>
    ) : (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Recently Played</h1>
          <p className={styles.subtitle}>
            Your most recently played tracks in chronological order
          </p>
        </div>
        
        <div className={styles.content}>
          <RecentlyPlayed limit={50} showTitle={false} />
        </div>
      </div>
    )
  )
} 