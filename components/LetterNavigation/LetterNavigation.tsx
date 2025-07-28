import React from 'react'
import { Music, Hash } from 'lucide-react'
import styles from './LetterNavigation.module.css'

interface LetterNavigationProps {
  albums: Array<{ title: string }>
  selectedLetter: string | null
  onLetterClick: (letter: string) => void
}

function LetterNavigation({ albums, selectedLetter, onLetterClick }: LetterNavigationProps): JSX.Element {
  // Generate available letters from albums
  const availableLetters = React.useMemo(() => {
    const letters = new Set<string>()
    
    albums.forEach(album => {
      const firstChar = album.title.charAt(0).toUpperCase()
      if (/[0-9]/.test(firstChar)) {
        letters.add('#')
      } else if (/[^A-Z0-9]/.test(firstChar)) {
        letters.add('~')
      } else if (/[A-Z]/.test(firstChar)) {
        letters.add(firstChar)
      }
    })
    
    return Array.from(letters).sort()
  }, [albums])

  return (
    <div className={styles.letterNav}>
      <button
        className={`${styles.letterButton} ${!selectedLetter ? styles.active : ''}`}
        onClick={() => onLetterClick('all')}
        aria-label="Show all albums"
      >
        <Music size={16} />
      </button>
      
      <button
        className={`${styles.letterButton} ${selectedLetter === '#' ? styles.active : ''} ${availableLetters.includes('#') ? styles.available : styles.unavailable}`}
        onClick={() => onLetterClick('#')}
        disabled={!availableLetters.includes('#')}
        aria-label="Albums starting with numbers"
      >
        <Hash size={16} />
      </button>

      {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map((letter) => (
        <button
          key={letter}
          className={`${styles.letterButton} ${
            selectedLetter === letter ? styles.active : ''
          } ${availableLetters.includes(letter) ? styles.available : styles.unavailable}`}
          onClick={() => onLetterClick(letter)}
          disabled={!availableLetters.includes(letter)}
          aria-label={`Albums starting with ${letter}`}
        >
          {letter}
        </button>
      ))}
    </div>
  )
}

export default LetterNavigation 