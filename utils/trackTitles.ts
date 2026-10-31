// Taper filenames often come through as titles like "dmb260530d1 01 Typical Situation".
// When every track on an album shares that shape, show just the song name.
const TAPER_PREFIX = /^\S*\d\S*\s+(\d{1,3})[\s._-]+(.+)$/

export interface DisplayTitle {
  title: string
  number?: number
}

/**
 * Clean titles for one album's tracks. Returns one entry per input track, in order.
 * Titles are only rewritten when the whole album matches the taper pattern, so a
 * normal album with one odd title is left alone.
 */
export function cleanAlbumTrackTitles(tracks: ReadonlyArray<{ title: string }>): DisplayTitle[] {
  const matches = tracks.map(t => TAPER_PREFIX.exec(t.title))
  const allMatch = tracks.length > 0 && matches.every(Boolean)
  return tracks.map((t, i) => {
    const m = matches[i]
    return allMatch && m ? { title: m[2], number: Number(m[1]) } : { title: t.title }
  })
}

/** Key for grouping the same song across shows: case, spacing and punctuation ignored. */
export function songKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '')
}
