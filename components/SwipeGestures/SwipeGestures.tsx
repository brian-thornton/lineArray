'use client'

import React, { useEffect, useRef, useState } from 'react'

interface SwipeGesturesProps {
  onSwipeLeft: () => void
  onSwipeRight: () => void
  children: React.ReactNode
  disabled?: boolean
}

function SwipeGestures({ onSwipeLeft, onSwipeRight, children, disabled = false }: SwipeGesturesProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null)

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled) return
    setTouchEnd(null)
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    })
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (disabled) return
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    })
  }

  const onTouchEnd = () => {
    if (disabled || !touchStart || !touchEnd) return

    const distanceX = touchStart.x - touchEnd.x
    const distanceY = touchStart.y - touchEnd.y
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY)

    if (isHorizontalSwipe && Math.abs(distanceX) > minSwipeDistance) {
      if (distanceX > 0) {
        // Swiped left
        onSwipeLeft()
      } else {
        // Swiped right
        onSwipeRight()
      }
    }

    setTouchStart(null)
    setTouchEnd(null)
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: 'pan-y' }} // Allow vertical scrolling, handle horizontal swipes
    >
      {children}
    </div>
  )
}

export default SwipeGestures 