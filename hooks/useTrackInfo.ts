'use client'

import { useEffect, useState } from 'react'

export interface TrackInfo {
  title: string
  albumId: string
  albumTitle: string
  coverPath?: string
}

// Shared across components and kept for the session: library info for a path doesn't change
const cache = new Map<string, TrackInfo | null>()

/**
 * Clean song name, album and cover for queued track paths (queue entries only carry file names).
 * Paths that aren't in the library map to null.
 */
export function useTrackInfo(paths: string[]): Map<string, TrackInfo | null> {
  const [, setVersion] = useState(0)
  const key = paths.join('\n')

  useEffect(() => {
    const missing = Array.from(new Set(paths.filter(p => p && !cache.has(p))))
    if (missing.length === 0) return
    let cancelled = false
    void (async (): Promise<void> => {
      try {
        const res = await fetch('/api/tracks/info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: missing })
        })
        if (!res.ok) return
        const { tracks } = await res.json() as { tracks: Record<string, TrackInfo> }
        for (const p of missing) cache.set(p, tracks[p] ?? null)
        if (!cancelled) setVersion(v => v + 1)
      } catch {
        // Leave uncached so the next render retries; rows fall back to file names meanwhile
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return cache
}

export const coverUrl = (coverPath?: string): string | null =>
  coverPath ? `/api/cover/${encodeURIComponent(coverPath)}` : null
