'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

interface LibraryState {
  currentPage: number
  selectedLetter: string | null
  layout: 'modern' | 'classic' | 'large'
}

interface LibraryContextType {
  libraryState: LibraryState
  updateLibraryState: (newState: Partial<LibraryState>) => void
  resetLibraryState: () => void
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined)

const defaultState: LibraryState = {
  currentPage: 1,
  selectedLetter: null,
  layout: 'modern'
}

export function LibraryProvider({ children }: { children: ReactNode }): JSX.Element {
  const [libraryState, setLibraryState] = useState<LibraryState>(defaultState)

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem('jukebox-library-state')
      if (savedState) {
        const parsedState = JSON.parse(savedState) as LibraryState
        setLibraryState(parsedState)
      }
    } catch (error) {
      console.error('Error loading library state:', error)
    }
  }, [])

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('jukebox-library-state', JSON.stringify(libraryState))
    } catch (error) {
      console.error('Error saving library state:', error)
    }
  }, [libraryState])

  const updateLibraryState = useCallback((newState: Partial<LibraryState>): void => {
    setLibraryState(prev => {
      // Only update the specific fields that are provided
      const updated = { ...prev }
      if (newState.currentPage !== undefined) updated.currentPage = newState.currentPage
      if (newState.selectedLetter !== undefined) updated.selectedLetter = newState.selectedLetter
      if (newState.layout !== undefined) updated.layout = newState.layout
      return updated
    })
  }, [])

  const resetLibraryState = useCallback((): void => {
    setLibraryState(defaultState)
  }, [])

  return (
    <LibraryContext.Provider value={{ 
      libraryState, 
      updateLibraryState, 
      resetLibraryState 
    }}>
      {children}
    </LibraryContext.Provider>
  )
}

export function useLibrary(): LibraryContextType {
  const context = useContext(LibraryContext)
  if (context === undefined) {
    throw new Error('useLibrary must be used within a LibraryProvider')
  }
  return context
} 