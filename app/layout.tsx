import React from 'react'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import Link from 'next/link'
import styles from './layout.module.css'
import Player from '@/components/Player'
import SearchBox from '@/components/SearchBox'
import { SearchProvider } from '@/contexts/SearchContext'
import { SettingsProvider } from '@/contexts/SettingsContext'
import JukeboxHeader from '@/components/JukeboxHeader'
import DynamicTitle from '@/components/DynamicTitle'

export const metadata: Metadata = {
  title: 'Jukebox 2.0',
  description: 'A modern jukebox application for your local music collection',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <SettingsProvider>
          <SearchProvider>
            <DynamicTitle />
            <header className={styles.header}>
              <JukeboxHeader />
              <div className={styles.searchSection}>
                <SearchBox />
              </div>
              <nav className={styles.nav}>
                <Link href="/">Library</Link>
                <Link href="/playlists">Playlists</Link>
                <Link href="/settings">Settings</Link>
              </nav>
            </header>
            <main className={styles.main}>
              {children}
            </main>
            <Player />
          </SearchProvider>
        </SettingsProvider>
      </body>
    </html>
  )
} 