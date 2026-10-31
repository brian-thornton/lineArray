'use client'

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { usePathname } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { useSearch } from '@/contexts/SearchContext'
import styles from './SearchBox.module.css'

export interface SearchBoxRef {
  hideKeyboard: () => void
  focus: () => void
  /** Empty the field and results without navigating anywhere */
  clear: () => void
  /** Fill the field (e.g. from a recent search) and run the search */
  setValue: (value: string) => void
}

// Wait for a pause in typing before searching
const SEARCH_DEBOUNCE_MS = 150

const SearchBox = forwardRef<SearchBoxRef>((_props, ref): JSX.Element => {
  const pathname = usePathname()
  const { performSearch, clearSearch, openSearch } = useSearch()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const hideKeyboard = (): void => {
    inputRef.current?.blur()
  }

  useImperativeHandle(ref, () => ({
    hideKeyboard,
    focus: (): void => inputRef.current?.focus(),
    clear: (): void => {
      setQuery('')
      clearSearch()
    },
    setValue: (value: string): void => {
      setQuery(value)
      inputRef.current?.focus()
    },
  }))

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setQuery(e.target.value)
  }

  useEffect(() => {
    if (!query.trim()) {
      clearSearch()
      return
    }
    const timer = setTimeout(() => { void performSearch(query) }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, performSearch, clearSearch])

  // Clear search when navigating to a new page
  useEffect(() => {
    clearSearch()
    setQuery('')
  }, [pathname, clearSearch])

  const handleClearSearch = (): void => {
    setQuery('')
    clearSearch()
    inputRef.current?.focus()
  }

  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchInputWrapper}>
        <Search className={styles.searchIcon} aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={handleInputChange}
          onFocus={openSearch}
          placeholder="Search artists, albums, songs"
          aria-label="Search the library"
          className={styles.searchInput}
          type="search"
          enterKeyHint="search"
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
            aria-label="Clear search"
          >
            <X className={styles.clearIcon} />
          </button>
        )}
      </div>
    </div>
  )
})

SearchBox.displayName = 'SearchBox'

export default SearchBox 