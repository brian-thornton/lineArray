"use client"

import React, { useState } from 'react'
import Player from '@/components/Player'
import Queue from '@/components/Queue'
import DynamicTitle from '@/components/DynamicTitle'
import AppHeader from '@/components/AppHeader'
import styles from '@/app/layout.module.css'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [showQueue, setShowQueue] = useState(false)
  return (
    <>
      <DynamicTitle />
      <AppHeader />
      <main className={styles.main}>
        {children}
      </main>
      <Player setShowQueue={setShowQueue} showQueue={showQueue} />
      <Queue isOpen={showQueue} onClose={() => setShowQueue(false)} />
    </>
  )
} 