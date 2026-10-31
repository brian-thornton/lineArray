'use client'

import { useEffect, useRef } from 'react'

/**
 * Moves focus into a dialog when it opens, so Escape (handled on the dialog) works straight
 * away and keyboard users start inside it.
 */
export function useDialogFocus<T extends HTMLElement = HTMLDivElement>(isOpen: boolean): React.RefObject<T> {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (isOpen) ref.current?.focus()
  }, [isOpen])
  return ref
}
