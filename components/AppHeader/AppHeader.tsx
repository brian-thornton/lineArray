'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, Smartphone } from 'lucide-react'
import styles from './AppHeader.module.css'
import JukeboxHeader from '@/components/JukeboxHeader/JukeboxHeader'
import SearchBox from '@/components/SearchBox/SearchBox'
import QRCode from '@/components/QRCode/QRCode'
import { useSearch } from '@/contexts/SearchContext'
import { useSettings } from '@/contexts/SettingsContext'

export default function AppHeader(): JSX.Element {
  const pathname = usePathname()
  const isAlbumPage = pathname?.startsWith('/album/')
  const { clearSearch, hideKeyboard, searchBoxRef } = useSearch()
  const { settings } = useSettings()
  const [showQR, setShowQR] = useState(false)

  const handleLibraryClick = (): void => {
    clearSearch()
    hideKeyboard()
  }

  const handleModalOverlayClick = (e: React.MouseEvent): void => {
    // Only close if clicking the overlay, not the modal content
    if (e.target === e.currentTarget) {
      setShowQR(false)
    }
  }

  const handleModalKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      setShowQR(false)
    }
  }
  
  return (
    <header className={`${styles.header} ${isAlbumPage ? styles.albumPage : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <JukeboxHeader />
        {settings.showMobileQR && (
          <button
            type="button"
            aria-label="Show Mobile Access QR Code"
            onClick={() => setShowQR(true)}
            className={styles.qrIcon}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 8 }}
          >
            <Smartphone size={28} style={{ color: 'var(--jukebox-gold)' }} />
          </button>
        )}
      </div>
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
      {showQR && (
        <div 
          onClick={handleModalOverlayClick}
          onKeyDown={handleModalKeyDown}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Access QR Code"
          tabIndex={-1}
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100vw', 
            height: '100vh', 
            background: 'rgba(0,0,0,0.7)', 
            zIndex: 2000, 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'center',
            paddingTop: '2rem',
            paddingBottom: '120px' // Account for player controls
          }}
        >
          <div style={{ 
            background: 'var(--jukebox-surface)', 
            borderRadius: 16, 
            padding: 24, 
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)', 
            position: 'relative', 
            maxWidth: 550, 
            width: '90vw',
            maxHeight: 'calc(100vh - 140px)', // Leave space for player controls
            overflowY: 'auto'
          }}>
            <button
              onClick={() => setShowQR(false)}
              aria-label="Close QR Code"
              style={{ 
                position: 'absolute', 
                top: 12, 
                right: 12, 
                background: 'none', 
                border: 'none', 
                fontSize: 24, 
                color: 'var(--jukebox-gray)', 
                cursor: 'pointer',
                zIndex: 1
              }}
            >
              ×
            </button>
            <QRCode />
          </div>
        </div>
      )}
    </header>
  )
} 