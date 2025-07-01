'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSearch } from '@/contexts/SearchContext'
import styles from './SearchBox.module.css'

export default function SearchBox() {
  const { performSearch, clearSearch, isSearching } = useSearch()
  const [query, setQuery] = useState('')
  const [showKeyboard, setShowKeyboard] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    
    if (value.trim()) {
      performSearch(value)
    } else {
      clearSearch()
    }
  }

  const handleKeyPress = (key: string) => {
    if (key === 'backspace') {
      setQuery(prev => prev.slice(0, -1))
    } else if (key === 'clear') {
      setQuery('')
      clearSearch()
    } else if (key === 'done') {
      setShowKeyboard(false)
      inputRef.current?.blur()
    } else {
      setQuery(prev => prev + key)
    }
  }

  const handleInputFocus = () => {
    setShowKeyboard(true)
  }

  const handleInputBlur = () => {
    // Don't hide keyboard on blur - only hide when "Done" is pressed
    // This allows the keyboard to stay open while typing
  }

  useEffect(() => {
    if (query.trim()) {
      performSearch(query)
    } else {
      clearSearch()
    }
  }, [query, performSearch, clearSearch])

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
            onClick={() => {
              setQuery('')
              clearSearch()
            }}
            className={styles.clearButton}
            type="button"
          >
            ✕
          </button>
        )}
      </div>

      {showKeyboard && (
        <div className={styles.keyboard}>
          {keyboardKeys.map((row, rowIndex) => (
            <div key={rowIndex} className={styles.keyboardRow}>
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
} 