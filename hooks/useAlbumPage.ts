import { useEffect, useState } from 'react'
import { Album } from '@/types/music'

export interface AlbumPage {
  /** Albums on this page */
  albums: Album[]
  totalPages: number
  /** Albums matching the letter filter (all albums without one) */
  matchingAlbums: number
  /** Albums in the library */
  totalAlbums: number
  /** Letter-index buckets that have albums: 'A'–'Z', '#', '~' */
  letters: string[]
}

/**
 * One page of the library from /api/albums. `limit` null means "not known yet" (the grid
 * hasn't measured its width), and nothing is fetched until it is. While a new page loads
 * the previous one is kept, so the grid doesn't blank between pages.
 */
export function useAlbumPage(page: number, limit: number | null, letter: string | null): { data: AlbumPage | null; isLoading: boolean } {
  const [data, setData] = useState<AlbumPage | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (limit === null) return
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (letter) params.set('letter', letter)
    setIsLoading(true)
    fetch(`/api/albums?${params.toString()}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        setData(await response.json() as AlbumPage)
        setIsLoading(false)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error('Error loading albums:', error)
        setIsLoading(false)
      })
    return () => { controller.abort() }
  }, [page, limit, letter])

  return { data, isLoading }
}
