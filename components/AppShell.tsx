"use client"

import React, { useState } from 'react'
import { usePathname } from 'next/navigation'
import Player from '@/components/Player/Player'
import Queue from '@/components/Queue/Queue'
import DynamicTitle from '@/components/DynamicTitle/DynamicTitle'
import AppHeader from '@/components/AppHeader/AppHeader'
import styles from '@/app/layout.module.css'

export default function AppShell({ children }: { children: React.ReactNode }): JSX.Element {
  const [showQueue, setShowQueue] = useState(false)
  const pathname = usePathname()
  return (
    <>
      <DynamicTitle />
      <AppHeader />
      <main className={styles.main}>
        <div key={pathname} className="slideIn">
          {children}
        </div>
      </main>
      <Player setShowQueue={setShowQueue} showQueue={showQueue} />
      <Queue isOpen={showQueue} onClose={() => setShowQueue(false)} />
    </>
  )
} 