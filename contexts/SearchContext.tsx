'use client'

import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { SearchBoxRef } from '@/components/SearchBox/SearchBox'
import type { SearchResponse, SearchResult } from '@/types/api'
import { usePlayback } from '@/contexts/PlaybackContext'

interface WindowWithPlayer extends Window {
  hasAddedTrackToQueue?: boolean
  checkPlayerStatusImmediately?: () => Promise<void>
}

interface SearchContextType {
  searchQuery: string
  searchResults: SearchResult[]
  isSearching: boolean
  performSearch: (query: string) => Promise<void>
  clearSearch: () => void
  /** Search-result click: plays now on this device, queues on the server jukebox. */
  playTrack: (path: string) => Promise<'playing' | 'queued' | null>
  hideKeyboard: () => void
  searchBoxRef: React.RefObject<SearchBoxRef>
  /** The search layer is showing (field focused/opened, or a query is typed) */
  searchOpen: boolean
  openSearch: () => void
  /** Leave search: empties the field and results and hides the search layer */
  closeSearch: () => void
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

export function SearchProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const playback = usePlayback()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchBoxRef = useRef<SearchBoxRef>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  // Each search gets a number; only the latest one may write results
  const latestRequest = useRef(0)

  const performSearch = useCallback(async (query: string): Promise<void> => {
    if (!query.trim()) {
      setSearchResults([])
      setSearchQuery('')
      return
    }

    const requestId = ++latestRequest.current
    setIsSearching(true)
    setSearchQuery(query)

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      if (requestId !== latestRequest.current) return
      if (response.ok) {
        const data = await response.json() as SearchResponse
        if (requestId !== latestRequest.current) return
        setSearchResults(data.results || [])
      } else {
        console.error('Search failed:', response.statusText)
        setSearchResults([])
      }
    } catch (error) {
      console.error('Search error:', error)
      if (requestId === latestRequest.current) setSearchResults([])
    } finally {
      if (requestId === latestRequest.current) setIsSearching(false)
    }
  }, [])

  const clearSearch = useCallback((): void => {
    latestRequest.current++
    setSearchQuery('')
    setSearchResults([])
    setIsSearching(false)
  }, [])

  const openSearch = useCallback((): void => setSearchOpen(true), [])

  const closeSearch = useCallback((): void => {
    searchBoxRef.current?.clear()
    searchBoxRef.current?.hideKeyboard()
    clearSearch()
    setSearchOpen(false)
  }, [clearSearch])

  const hideKeyboard = useCallback((): void => {
    searchBoxRef.current?.hideKeyboard()
  }, [])

  const playTrack = useCallback(async (path: string): Promise<'playing' | 'queued' | null> => {
    try {
      const playsHere = playback.mode === 'browser'
      const data = playsHere ? await playback.playNow([path]) : await playback.addToQueue(path)

      if (!data) {
        console.error('Failed to play track')
        return null
      } else {
        // Set flag to show player controls
        if (typeof window !== 'undefined') {
          (window as WindowWithPlayer).hasAddedTrackToQueue = true
        }
        
        // Immediately check player status to show controls faster
        if (typeof window !== 'undefined' && (window as WindowWithPlayer).checkPlayerStatusImmediately) {
          setTimeout(() => {
            (window as WindowWithPlayer).checkPlayerStatusImmediately?.()
          }, 100)
        }
        return playsHere ? 'playing' : 'queued'
      }
    } catch (error) {
      console.error('Error playing track:', error)
      return null
    }
  }, [playback])

  const value: SearchContextType = {
    searchQuery,
    searchResults,
    isSearching,
    performSearch,
    clearSearch,
    hideKeyboard,
    playTrack,
    searchBoxRef,
    searchOpen,
    openSearch,
    closeSearch,
  }

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch(): SearchContextType {
  const context = useContext(SearchContext)
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider')
  }
  return context
} 