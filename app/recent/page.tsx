'use client'

import React from 'react'
import RecentlyPlayed from '@/components/RecentlyPlayed'
import styles from './page.module.css'

export default function RecentPage(): JSX.Element {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Recently Played</h1>
        <p className={styles.subtitle}>
          Your most recently played tracks in chronological order
        </p>
      </div>
      
      <div className={styles.content}>
        <RecentlyPlayed limit={50} showTitle={false} />
      </div>
    </div>
  )
} 