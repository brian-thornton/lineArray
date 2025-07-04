'use client'

import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { SearchBoxRef } from '@/components/SearchBox/SearchBox'

interface SearchResult {
  type: 'album' | 'track'
  id: string
  title: string
  artist: string
  album?: string
  path?: string
}

interface SearchContextType {
  searchQuery: string
  searchResults: SearchResult[]
  isSearching: boolean
  performSearch: (query: string) => Promise<void>
  clearSearch: () => void
  addTrackToQueue: (path: string) => Promise<void>
  hideKeyboard: () => void
  searchBoxRef: React.RefObject<SearchBoxRef>
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchBoxRef = useRef<SearchBoxRef>(null)

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setSearchQuery('')
      return
    }

    setIsSearching(true)
    setSearchQuery(query)

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.results || [])
      } else {
        console.error('Search failed:', response.statusText)
        setSearchResults([])
      }
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults([])
    setIsSearching(false)
  }, [])

  const hideKeyboard = useCallback(() => {
    searchBoxRef.current?.hideKeyboard()
  }, [])

  const addTrackToQueue = useCallback(async (path: string) => {
    try {
      const response = await fetch('/api/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path }),
      })

      if (!response.ok) {
        console.error('Failed to add track to queue:', response.statusText)
      } else {
        // Set flag to show player controls
        if (typeof window !== 'undefined') {
          (window as any).hasAddedTrackToQueue = true
        }
        
        // Immediately check player status to show controls faster
        if (typeof window !== 'undefined' && (window as any).checkPlayerStatusImmediately) {
          setTimeout(() => {
            (window as any).checkPlayerStatusImmediately()
          }, 100)
        }
      }
    } catch (error) {
      console.error('Error adding track to queue:', error)
    }
  }, [])

  const value: SearchContextType = {
    searchQuery,
    searchResults,
    isSearching,
    performSearch,
    clearSearch,
    hideKeyboard,
    addTrackToQueue,
    searchBoxRef,
  }

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch() {
  const context = useContext(SearchContext)
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider')
  }
  return context
} 