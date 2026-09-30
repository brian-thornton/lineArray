'use client'

import { useCallback } from 'react'
import { useQueueToast } from '@/components/QueueToast/QueueToastContext'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useAddToQueue } from '@/hooks/useAddToQueue'

interface PlayNowOptions {
  path: string
  /** Display name shown in the toast */
  title?: string
}

/**
 * Returns the handler for a track's play button. On this device the track starts
 * immediately; on the shared server jukebox it is queued (see useAddToQueue).
 */
export function usePlayNow(): (opts: PlayNowOptions) => Promise<boolean> {
  const { showQueueToast } = useQueueToast()
  const playback = usePlayback()
  const addToQueue = useAddToQueue()

  return useCallback(async ({ path, title }: PlayNowOptions): Promise<boolean> => {
    if (playback.mode !== 'browser') return addToQueue({ path, title })

    const data = await playback.playNow([path])
    if (!data) return false
    const displayTitle = title ?? path.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? 'Track'
    showQueueToast(displayTitle, null)
    return true
  }, [showQueueToast, playback, addToQueue])
}
