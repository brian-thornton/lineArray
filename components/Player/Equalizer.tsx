"use client"

import React, { useEffect, useRef } from 'react'
import { useThemeContext } from '@/contexts/ThemeContext'
import styles from './Equalizer.module.css'

interface EqualizerProps {
  isPlaying: boolean
  progress: number
  onSeekStart: () => void
  onSeekDrag: (position: number) => void
  onSeekEnd: (position: number) => void
  disabled?: boolean
}

// Helper function to extract solid colors from potential gradient strings
const extractSolidColor = (colorValue: string): string => {
  // Handle null/undefined/empty values
  if (!colorValue || typeof colorValue !== 'string') {
    return '#4A90E2' // Safe fallback
  }
  
  // If it's already a solid color (hex, rgb, etc.), return as is
  if (colorValue.startsWith('#') || colorValue.startsWith('rgb') || colorValue.startsWith('hsl')) {
    return colorValue
  }
  
  // If it's a gradient, try to extract the first color
  if (colorValue.includes('gradient')) {
    // Extract first color from gradient (e.g., "linear-gradient(135deg, #065f46 0%, #581c87 100%)" -> "#065f46")
    const match = colorValue.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|rgb\([^)]+\)|hsl\([^)]+\)/)
    if (match) {
      return match[0]
    }
  }
  
  // Try to extract any hex color from the string
  const hexMatch = colorValue.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}/)
  if (hexMatch) {
    return hexMatch[0]
  }
  
  // Fallback to a safe color if we can't parse it
  return '#4A90E2'
}

const Equalizer = ({ 
  isPlaying, 
  progress, 
  onSeekStart, 
  onSeekDrag, 
  onSeekEnd, 
  disabled = false 
}: EqualizerProps): JSX.Element => {
  const { currentTheme } = useThemeContext()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const barsRef = useRef<number[]>([])
  const timeRef = useRef<number>(0)

  // Initialize bars with random heights
  useEffect((): void => {
    if (!barsRef.current.length) {
      barsRef.current = Array.from({ length: 20 }, () => Math.random() * 0.3 + 0.1)
    }
  }, [])

  // Animation loop
  useEffect(() => {
    if (!canvasRef.current || disabled) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const animate = (timestamp: number): void => {
      if (!ctx || !canvas) return

      timeRef.current = timestamp

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const barWidth = canvas.width / 20
      const maxHeight = canvas.height * 0.8

      // Get current theme colors and ensure they're solid colors
      const primaryColor = extractSolidColor(currentTheme.colors.primary)
      const accentColor = extractSolidColor(currentTheme.colors.accent)
      const secondaryColor = extractSolidColor(currentTheme.colors.secondary)

      // Update and draw bars
      for (let i = 0; i < 20; i++) {
        if (isPlaying) {
          // Animated bars when playing
          barsRef.current[i] += (Math.random() - 0.5) * 0.1
          barsRef.current[i] = Math.max(0.1, Math.min(0.9, barsRef.current[i]))
        } else {
          // Static bars when paused
          barsRef.current[i] = 0.3
        }

        const barHeight = barsRef.current[i] * maxHeight
        const x = i * barWidth + barWidth * 0.1
        const y = canvas.height - barHeight

        // Create gradient for each bar using theme colors
        const gradient = ctx.createLinearGradient(x, y, x, canvas.height)
        gradient.addColorStop(0, accentColor)
        gradient.addColorStop(0.5, secondaryColor)
        gradient.addColorStop(1, primaryColor)

        ctx.fillStyle = gradient
        ctx.fillRect(x, y, barWidth * 0.8, barHeight)

        // Add glow effect using accent color
        ctx.shadowColor = accentColor
        ctx.shadowBlur = isPlaying ? 8 : 4
        ctx.fillRect(x, y, barWidth * 0.8, barHeight)
        ctx.shadowBlur = 0
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, progress, disabled, currentTheme])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (disabled) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const newProgress = x / canvas.width
    const clampedProgress = Math.max(0, Math.min(1, newProgress))

    onSeekStart()
    onSeekDrag(clampedProgress)
    onSeekEnd(clampedProgress)
  }

  const handleCanvasMouseDown = (_e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (disabled) return
    onSeekStart()
  }

  const handleTouchStart = (_e: React.TouchEvent<HTMLCanvasElement>): void => {
    if (disabled) return
    onSeekStart()
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (disabled) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const newProgress = x / canvas.width
    const clampedProgress = Math.max(0, Math.min(1, newProgress))

    onSeekDrag(clampedProgress)
  }

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (disabled) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const newProgress = x / canvas.width
    const clampedProgress = Math.max(0, Math.min(1, newProgress))

    onSeekEnd(clampedProgress)
  }

  return (
    <canvas
      ref={canvasRef}
      className={styles.equalizer}
      width={300}
      height={40}
      onClick={handleCanvasClick}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={(e) => {
        e.preventDefault();
        const [touch] = Array.from(e.touches);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const newProgress = x / canvas.width;
        const clampedProgress = Math.max(0, Math.min(1, newProgress));
        onSeekDrag(clampedProgress);
      }}
      onTouchEnd={(e) => {
        const [touch] = Array.from(e.changedTouches);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const newProgress = x / canvas.width;
        const clampedProgress = Math.max(0, Math.min(1, newProgress));
        onSeekEnd(clampedProgress);
      }}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
      aria-label="Playback position equalizer"
    />
  )
}

export default Equalizer
