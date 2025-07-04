'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings } from 'lucide-react'
import styles from './AppHeader.module.css'
import JukeboxHeader from '@/components/JukeboxHeader'
import SearchBox from '@/components/SearchBox'
import { useSearch } from '@/contexts/SearchContext'

export default function AppHeader() {
  const pathname = usePathname()
  const isAlbumPage = pathname?.startsWith('/album/')
  const { clearSearch, hideKeyboard, searchBoxRef } = useSearch()

  const handleLibraryClick = () => {
    clearSearch()
    hideKeyboard()
  }
  
  return (
    <header className={`${styles.header} ${isAlbumPage ? styles.albumPage : ''}`}>
      <JukeboxHeader />
      <div className={styles.searchSection}>
        <SearchBox ref={searchBoxRef} />
      </div>
      <nav className={styles.nav}>
        <Link href="/" onClick={handleLibraryClick}>Library</Link>
        <Link href="/recent">Recent</Link>
        <Link href="/playlists">Playlists</Link>
        <Link href="/settings" className={styles.settingsButton} aria-label="Settings">
          <Settings size={20} />
        </Link>
      </nav>
    </header>
  )
} 