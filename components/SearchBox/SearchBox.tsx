'use client'

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSearch } from '@/contexts/SearchContext'
import styles from './SearchBox.module.css'

export interface SearchBoxRef {
  hideKeyboard: () => void
}

const SearchBox = forwardRef<SearchBoxRef>((_props, ref): JSX.Element => {
  const router = useRouter()
  const pathname = usePathname()
  const isAlbumPage = pathname?.startsWith('/album/')
  const { performSearch, clearSearch } = useSearch()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const hideKeyboard = (): void => {
    inputRef.current?.blur()
  }

  useImperativeHandle(ref, () => ({
    hideKeyboard
  }))

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const {value} = e.target
    setQuery(value)

    if (value.trim()) {
      void performSearch(value)
    } else {
      clearSearch()
    }
  }

  useEffect(() => {
    if (query.trim()) {
      void performSearch(query)
    } else {
      clearSearch()
    }
  }, [query, performSearch, clearSearch])

  // Clear search when navigating to a new page
  useEffect(() => {
    clearSearch()
    setQuery('')
  }, [pathname, clearSearch])

  const handleClearSearch = (): void => {
    setQuery('')
    clearSearch()
    
    // Navigate back to library if on album detail page
    if (isAlbumPage) {
      router.push('/')
    }
  }

  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchInputWrapper}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Search albums and tracks..."
          className={styles.searchInput}
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        {query && (
          <button
            onClick={handleClearSearch}
            className={styles.clearButton}
            type="button"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
})

SearchBox.displayName = 'SearchBox'

export default SearchBox 