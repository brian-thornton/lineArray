'use client'

import React from 'react'
import { useSettings } from '@/contexts/SettingsContext'
import styles from './JukeboxHeader.module.css'

export default function JukeboxHeader(): JSX.Element {
  const { settings } = useSettings()

  return (
    <div className={styles.logo}>
      {settings.jukeboxName}
    </div>
  )
} 