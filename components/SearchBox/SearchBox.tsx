'use client'

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSearch } from '@/contexts/SearchContext'
import { useSettings } from '@/contexts/SettingsContext'
import styles from './SearchBox.module.css'

export interface SearchBoxRef {
  hideKeyboard: () => void
}

const SearchBox = forwardRef<SearchBoxRef>((_props, ref): JSX.Element => {
  const router = useRouter()
  const pathname = usePathname()
  const isAlbumPage = pathname?.startsWith('/album/')
  const { performSearch, clearSearch } = useSearch()
  const { settings } = useSettings()
  const [query, setQuery] = useState('')
  const [showKeyboard, setShowKeyboard] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Detect mobile devices
  useEffect(() => {
    const checkMobile = (): void => {
      const isMobileDevice = window.innerWidth <= 768 || 
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      setIsMobile(isMobileDevice)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const hideKeyboard = (): void => {
    setShowKeyboard(false)
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

  const handleKeyPress = (key: string): void => {
    if (key === 'backspace') {
      setQuery(prev => prev.slice(0, -1))
    } else if (key === 'clear') {
      handleClearSearch()
    } else if (key === 'done') {
      setShowKeyboard(false)
      inputRef.current?.blur()
    } else {
      setQuery(prev => prev + key)
    }
  }

  const handleInputFocus = (): void => {
    // Only show on-screen keyboard on desktop/tablet, not on mobile, and only if enabled in settings
    if (!isMobile && settings.showTouchKeyboard) {
      setShowKeyboard(true)
    }
  }

  const handleInputBlur = (): void => {
    // Don't hide keyboard on blur - only hide when "Done" is pressed
    // This allows the keyboard to stay open while typing
  }

  useEffect(() => {
    if (query.trim()) {
      void performSearch(query)
    } else {
      clearSearch()
    }
  }, [query, performSearch, clearSearch])

  const handleClearSearch = (): void => {
    setQuery('')
    clearSearch()
    
    // Navigate back to library if on album detail page
    if (isAlbumPage) {
      router.push('/')
    }
  }

  const keyboardKeys = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'backspace'],
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['space', 'clear', 'done']
  ]

  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchInputWrapper}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
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

      {showKeyboard && !isMobile && (
        <div className={styles.keyboard}>
          {keyboardKeys.map((row, rowIndex) => (
            // eslint-disable-next-line react/no-array-index-key -- static keyboard layout
            <div key={`row-${rowIndex}`} className={styles.keyboardRow}>
              {row.map((key) => {
                let keyClass = styles.key
                let keyText = key
                let keyWidth = ''

                if (key === 'backspace') {
                  keyClass += ` ${styles.specialKey}`
                  keyText = '⌫'
                  keyWidth = styles.backspaceKey
                } else if (key === 'space') {
                  keyClass += ` ${styles.specialKey}`
                  keyText = 'Space'
                  keyWidth = styles.spaceKey
                } else if (key === 'clear') {
                  keyClass += ` ${styles.specialKey}`
                  keyText = 'Clear'
                  keyWidth = styles.clearKey
                } else if (key === 'done') {
                  keyClass += ` ${styles.specialKey}`
                  keyText = 'Done'
                  keyWidth = styles.doneKey
                }

                return (
                  <button
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    className={`${keyClass} ${keyWidth}`}
                    type="button"
                  >
                    {keyText}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

SearchBox.displayName = 'SearchBox'

export default SearchBox 