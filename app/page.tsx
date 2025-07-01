'use client'

import React, { useState, useEffect } from 'react'
import { Album, Track } from '@/types/music'
import JukeboxHeader from '@/components/JukeboxHeader'
import AlbumGrid from '@/components/AlbumGrid'
import SearchResults from '@/components/SearchResults'
import { useSearch } from '@/contexts/SearchContext'
import styles from './page.module.css'

export default function Home() {
  const { searchQuery, searchResults, isSearching, addTrackToQueue } = useSearch()
  const [albums, setAlbums] = useState<Album[]>([])
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [currentPath, setCurrentPath] = useState('')

  useEffect(() => {
    loadAlbums()
  }, [])

  const loadAlbums = async () => {
    try {
      const response = await fetch('/api/albums')
      if (response.ok) {
        const data = await response.json()
        setAlbums(data.albums || [])
        setCurrentPath(data.scanPath || '')
      }
    } catch (error) {
      console.error('Error loading albums:', error)
    }
  }

  const handlePlayTrack = (track: Track) => {
    setCurrentTrack(track)
    setIsPlaying(true)
  }

  const handlePlay = () => {
    setIsPlaying(true)
  }

  const handlePause = () => {
    setIsPlaying(false)
  }

  const handleStop = () => {
    setIsPlaying(false)
    setCurrentTrack(null)
  }

  const handleTrackClick = async (path: string) => {
    await addTrackToQueue(path)
  }

  // Create a default track if no track is selected
  const defaultTrack: Track = {
    id: 'default',
    title: 'No track selected',
    artist: 'Unknown',
    album: 'Unknown',
    path: '',
    duration: 0,
    trackNumber: 0
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        {searchQuery ? (
          <SearchResults 
            results={searchResults}
            onTrackClick={handleTrackClick}
            isLoading={isSearching}
          />
        ) : (
          <AlbumGrid 
            albums={albums}
            onPlayTrack={handlePlayTrack}
            isLoading={isScanning}
          />
        )}
      </main>
    </div>
  )
} 