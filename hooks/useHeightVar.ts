'use client'

import { useCallback, useRef } from 'react'

/**
 * Callback ref that publishes an element's height as a CSS variable on <html> (0px while it's
 * unmounted), so fixed panels like Up Next can sit exactly between the header and the player bar.
 */
export function useHeightVar(cssVar: string): (el: HTMLElement | null) => void {
  const observer = useRef<ResizeObserver | null>(null)
  return useCallback((el: HTMLElement | null) => {
    observer.current?.disconnect()
    observer.current = null
    const root = document.documentElement
    if (!el) {
      root.style.setProperty(cssVar, '0px')
      return
    }
    const update = (): void => { root.style.setProperty(cssVar, `${el.getBoundingClientRect().height}px`) }
    update()
    observer.current = new ResizeObserver(update)
    observer.current.observe(el)
  }, [cssVar])
}
