'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

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
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

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
    addTrackToQueue,
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