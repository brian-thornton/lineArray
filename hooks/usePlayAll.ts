'use client'

import { useCallback } from 'react'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useSearch } from '@/contexts/SearchContext'
import { useQueueToast } from '@/components/QueueToast/QueueToastContext'

interface WindowWithPlayer extends Window {
  hasAddedTrackToQueue?: boolean
  checkPlayerStatusImmediately?: () => Promise<void>
}

/**
 * Play a list of tracks the way Play Album does: on this device they start now, on the
 * shared server jukebox they join the end of the queue with one summary toast.
 */
export function usePlayAll(): (paths: string[], label: string) => Promise<void> {
  const playback = usePlayback()
  const { hideKeyboard } = useSearch()
  const { showQueueToast } = useQueueToast()

  return useCallback(async (paths: string[], label: string): Promise<void> => {
    if (paths.length === 0) return
    if (playback.mode === 'browser') {
      await playback.playNow(paths)
    } else {
      let lastQueueLength = 0
      for (const path of paths) {
        const data = await playback.addToQueue(path)
        if (data) lastQueueLength = data.queue.length
      }
      showQueueToast(label, lastQueueLength > 0 ? lastQueueLength : null)
    }
    hideKeyboard()
    const w = window as WindowWithPlayer
    w.hasAddedTrackToQueue = true
    setTimeout(() => { void w.checkPlayerStatusImmediately?.() }, 100)
  }, [playback, hideKeyboard, showQueueToast])
}

export function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
