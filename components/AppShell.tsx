"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Player from '@/components/Player/Player'
import UpNext, { type UpNextLayout } from '@/components/UpNext/UpNext'
import DynamicTitle from '@/components/DynamicTitle/DynamicTitle'
import AppHeader from '@/components/AppHeader/AppHeader'
import IdleScreen from '@/components/IdleScreen/IdleScreen'
import SearchPanel from '@/components/SearchPanel/SearchPanel'
import styles from '@/app/layout.module.css'
import { QueueToastProvider } from '@/components/QueueToast/QueueToastContext'
import { useSearch } from '@/contexts/SearchContext'
import { useMediaQuery } from '@/hooks/useMediaQuery'

const RAIL_HIDDEN_KEY = 'jukebox-upnext-hidden'

export default function AppShell({ children }: { children: React.ReactNode }): JSX.Element {
  const pathname = usePathname()
  const { searchOpen, searchQuery } = useSearch()
  const showSearch = searchOpen || searchQuery.trim() !== ''

  // Up Next placement: docked rail that shifts the page (1024px+), slide-over on tablets, sheet on phones
  const wide = useMediaQuery('(min-width: 1024px)')
  const phone = useMediaQuery('(max-width: 768px)')
  const layout: UpNextLayout = wide ? 'rail' : phone ? 'sheet' : 'overlay'

  // Rail: shown whenever there's music, unless someone hid it; it also opens when asked even if
  // the queue is empty. Overlay/sheet: closed until the queue button is pressed.
  const [railHidden, setRailHidden] = useState(false)
  const [railForced, setRailForced] = useState(false)
  const [floatingOpen, setFloatingOpen] = useState(false)
  const [hasContent, setHasContent] = useState(false)

  useEffect(() => {
    try { setRailHidden(localStorage.getItem(RAIL_HIDDEN_KEY) === '1') } catch { /* storage unavailable */ }
  }, [])

  const setHidden = useCallback((hidden: boolean): void => {
    setRailHidden(hidden)
    try { localStorage.setItem(RAIL_HIDDEN_KEY, hidden ? '1' : '0') } catch { /* storage unavailable */ }
  }, [])

  const railVisible = !railHidden && (hasContent || railForced)
  const upNextOpen = layout === 'rail' ? railVisible : floatingOpen

  const toggleUpNext = (): void => {
    if (layout !== 'rail') {
      setFloatingOpen(open => !open)
    } else if (railVisible) {
      setHidden(true)
      setRailForced(false)
    } else {
      setHidden(false)
      setRailForced(true)
    }
  }

  const closeUpNext = useCallback((): void => {
    if (layout === 'rail') {
      setHidden(true)
      setRailForced(false)
    } else {
      setFloatingOpen(false)
    }
  }, [layout, setHidden])

  // The phone sheet covers the page, so leave it when navigating
  useEffect(() => {
    if (layout === 'sheet') setFloatingOpen(false)
  }, [pathname, layout])

  const docked = layout === 'rail' && railVisible

  // Lets fixed-position UI (queue toasts) move clear of the docked rail
  useEffect(() => {
    document.documentElement.toggleAttribute('data-upnext-docked', docked)
  }, [docked])

  return (
    <QueueToastProvider>
      <DynamicTitle />
      <AppHeader />
      <main className={`${styles.main} ${docked ? styles.withRail : ''}`}>
        {showSearch && <SearchPanel />}
        {/* The page stays mounted under search so closing search returns to the same spot */}
        <div key={pathname} className="slideIn" hidden={showSearch}>
          {children}
        </div>
      </main>
      <Player onToggleQueue={toggleUpNext} showQueue={upNextOpen} />
      <UpNext layout={layout} open={upNextOpen} onClose={closeUpNext} onContentChange={setHasContent} />
      <IdleScreen />
    </QueueToastProvider>
  )
}
