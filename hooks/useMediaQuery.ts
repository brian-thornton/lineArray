'use client'

import { useEffect, useState } from 'react'

/** Live result of a CSS media query (false during server render and the first client render) */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const update = (): void => setMatches(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [query])
  return matches
}
