'use client'

import { useCallback } from 'react'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useAddToQueue } from '@/hooks/useAddToQueue'

interface PlayNowOptions {
  path: string
  /** Display name for the queue toast (server mode) */
  title?: string
}

/**
 * Returns the handler for a track's play button. On this device the track starts
 * immediately; on the shared server jukebox it is queued (see useAddToQueue).
 */
export function usePlayNow(): (opts: PlayNowOptions) => Promise<boolean> {
  const playback = usePlayback()
  const addToQueue = useAddToQueue()

  return useCallback(async ({ path, title }: PlayNowOptions): Promise<boolean> => {
    if (playback.mode !== 'browser') return addToQueue({ path, title })

    // No toast: the track starting is the feedback.
    return (await playback.playNow([path])) !== null
  }, [playback, addToQueue])
}
