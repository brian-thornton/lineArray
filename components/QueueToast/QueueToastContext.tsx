'use client'

import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import styles from './QueueToast.module.css'
import { ListMusic } from 'lucide-react'

interface QueueToast {
  id: number
  title: string
  /** Queue position (1-based). null means the track started playing immediately. */
  position: number | null
  /** true while the enter animation is running */
  entering: boolean
  /** true while the exit animation is running */
  exiting: boolean
}

interface QueueToastContextValue {
  showQueueToast: (title: string, position: number | null) => void
}

const QueueToastContext = createContext<QueueToastContextValue | null>(null)

export function useQueueToast(): QueueToastContextValue {
  const ctx = useContext(QueueToastContext)
  if (!ctx) throw new Error('useQueueToast must be used inside QueueToastProvider')
  return ctx
}

const MAX_VISIBLE = 4
const DISPLAY_MS = 3000
const ANIM_MS = 320

export function QueueToastProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<QueueToast[]>([])
  const nextId = useRef(0)

  const remove = useCallback((id: number) => {
    // Start exit animation
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, ANIM_MS)
  }, [])

  const showQueueToast = useCallback((title: string, position: number | null) => {
    const id = nextId.current++

    setToasts(prev => {
      const next = [...prev, { id, title, position, entering: true, exiting: false }]
      // Keep only the latest MAX_VISIBLE (immediately drop oldest without animation)
      return next.slice(-MAX_VISIBLE)
    })

    // Remove entering flag after animation completes
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, entering: false } : t))
    }, ANIM_MS)

    // Auto-dismiss
    setTimeout(() => remove(id), DISPLAY_MS)
  }, [remove])

  return (
    <QueueToastContext.Provider value={{ showQueueToast }}>
      {children}
      <div className={styles.container} aria-live="polite" aria-atomic="false">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={[
              styles.toast,
              toast.entering ? styles.entering : '',
              toast.exiting ? styles.exiting : '',
            ].join(' ')}
          >
            <div className={styles.icon}>
              <ListMusic size={16} />
            </div>
            <div className={styles.body}>
              <span className={styles.label}>
                {toast.position === null ? 'Playing now' : `Added to queue · #${toast.position}`}
              </span>
              <span className={styles.title}>{toast.title}</span>
            </div>
            <div className={styles.progress} style={{ animationDuration: `${DISPLAY_MS}ms` }} />
          </div>
        ))}
      </div>
    </QueueToastContext.Provider>
  )
}
