'use client'

import React from 'react'
import { useSettings } from '@/contexts/SettingsContext'
import styles from './JukeboxHeader.module.css'

export default function JukeboxHeader() {
  const { settings } = useSettings()

  return (
    <div className={styles.logo}>
      {settings.jukeboxName}
    </div>
  )
} 