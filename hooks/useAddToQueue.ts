'use client'

import { useCallback } from 'react'
import { useQueueToast } from '@/components/QueueToast/QueueToastContext'

interface AddToQueueOptions {
  path: string
  isAlbum?: boolean
  /** Display name shown in the toast */
  title?: string
}

interface QueueApiResponse {
  success?: boolean
  error?: string
  isPlaying?: boolean
  currentTrack?: { title?: string } | null
  queue?: Array<{ title?: string }>
}

/**
 * Returns a function that adds a track to the queue and shows a toast.
 * The toast shows the queue position (number of tracks in queue after adding).
 */
export function useAddToQueue(): (opts: AddToQueueOptions) => Promise<boolean> {
  const { showQueueToast } = useQueueToast()

  return useCallback(async ({ path, isAlbum = false, title }: AddToQueueOptions): Promise<boolean> => {
    const res = await fetch('/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, isAlbum }),
    })

    if (!res.ok) return false

    const data: QueueApiResponse = await res.json()
    if (!data.success) return false

    // Determine display title (fall back to filename stem)
    const displayTitle = title ?? path.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? 'Track'

    // Determine queue position.
    // After the add, the API returns the current state. The added track is the
    // last item in `queue`. Its 1-based position in the full upcoming list equals
    // the number of tracks in `queue` (since currentTrack is already playing).
    const queueLength = data.queue?.length ?? 0
    const hasCurrentTrack = !!data.currentTrack

    let position: number | null
    if (!hasCurrentTrack && queueLength === 0) {
      // Track started playing immediately
      position = null
    } else if (!hasCurrentTrack) {
      // Not playing yet — it's next up
      position = queueLength
    } else {
      // Something already playing — position is its slot in the upcoming queue
      position = queueLength
    }

    showQueueToast(displayTitle, position)
    return true
  }, [showQueueToast])
}
