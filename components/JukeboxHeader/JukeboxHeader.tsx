'use client'

import React from 'react'
import Link from 'next/link'
import { useSettings } from '@/contexts/SettingsContext'
import { useSearch } from '@/contexts/SearchContext'
import styles from './JukeboxHeader.module.css'

export default function JukeboxHeader(): JSX.Element {
  const { settings } = useSettings()
  const { clearSearch, hideKeyboard } = useSearch()

  const handleLogoClick = (): void => {
    clearSearch()
    hideKeyboard()
  }

  return (
    <Link href="/" onClick={handleLogoClick} className={styles.logo}>
      {settings.jukeboxName}
    </Link>
  )
} 