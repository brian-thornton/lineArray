'use client'

import React, { useState, useEffect } from 'react'
import { Play, X, GripVertical, Music, ChevronDown, ChevronUp } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import styles from './Queue.module.css'

interface QueueTrack {
  id: string
  path: string
  title: string
  artist: string
  album: string
  duration: string
}

interface QueueProps {
  isOpen: boolean
  onClose: () => void
}

interface CurrentTrack {
  id: string
  path: string
  title: string
  artist: string
  album: string
  duration: string
}

export default function Queue({ isOpen, onClose }: QueueProps) {
  const { canPerformAction } = useSettings()
  const [queue, setQueue] = useState<QueueTrack[]>([])
  const [currentTrack, setCurrentTrack] = useState<string | CurrentTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [draggedTrack, setDraggedTrack] = useState<string | null>(null)
  const [dragTarget, setDragTarget] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadQueue()
      const interval = setInterval(loadQueue, 2000)
      return () => clearInterval(interval)
    }
  }, [isOpen])

  const loadQueue = async () => {
    try {
      const response = await fetch('/api/queue')
      if (response.ok) {
        const data = await response.json()
        console.log('Queue data loaded:', data)
        setQueue(data.queue || [])
        setCurrentTrack(data.currentTrack)
        setIsPlaying(data.isPlaying)
      }
    } catch (error) {
      console.error('Error loading queue:', error)
    }
  }

  const handleRemoveTrack = async (trackId: string) => {
    if (!canPerformAction('allowRemoveFromQueue')) {
      alert('Removing from queue is restricted in party mode')
      return
    }

    try {
      const response = await fetch(`/api/queue/${trackId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadQueue()
      } else {
        console.error('Failed to remove track from queue')
      }
    } catch (error) {
      console.error('Error removing track from queue:', error)
    }
  }

  const handlePlayTrack = async (trackId: string) => {
    if (!canPerformAction('allowAddToQueue')) {
      alert('Playing tracks is restricted in party mode')
      return
    }

    try {
      const response = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'playTrack', trackId }),
      })

      if (response.ok) {
        await loadQueue()
      } else {
        console.error('Failed to play track')
      }
    } catch (error) {
      console.error('Error playing track:', error)
    }
  }

  const handleDragStart = (e: React.DragEvent, trackId: string) => {
    console.log('Drag start:', trackId)
    setDraggedTrack(trackId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', trackId)
  }

  const handleDragEnd = (e: React.DragEvent) => {
    console.log('Drag end')
    setDraggedTrack(null)
    setDragTarget(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (e: React.DragEvent, trackId: string) => {
    e.preventDefault()
    setDragTarget(trackId)
    ;(e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragTarget(null)
    ;(e.currentTarget as HTMLElement).style.backgroundColor = ''
  }

  const handleDrop = async (e: React.DragEvent, targetTrackId: string) => {
    e.preventDefault()
    setDragTarget(null)
    ;(e.currentTarget as HTMLElement).style.backgroundColor = ''
    
    console.log('Drop event:', { draggedTrack, targetTrackId })
    
    if (!draggedTrack || draggedTrack === targetTrackId) {
      setDraggedTrack(null)
      return
    }

    if (!canPerformAction('allowRemoveFromQueue')) {
      alert('Queue management is restricted in party mode')
      setDraggedTrack(null)
      return
    }

    try {
      console.log('Sending reorder request:', { draggedTrack, targetTrackId })
      const response = await fetch('/api/queue/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draggedTrackId: draggedTrack,
          targetTrackId: targetTrackId
        })
      })

      if (response.ok) {
        console.log('Reorder successful')
        await loadQueue()
      } else {
        const error = await response.json()
        console.error('Failed to reorder tracks:', error)
        alert('Failed to reorder tracks')
      }
    } catch (error) {
      console.error('Error reordering tracks:', error)
      alert('Error reordering tracks')
    } finally {
      setDraggedTrack(null)
    }
  }

  const getTrackName = (path: string): string => {
    const pathParts = path.split('/')
    const filename = pathParts[pathParts.length - 1]
    return filename.replace(/\.[^/.]+$/, '')
  }

  console.log('Queue component render:', { isOpen, queueLength: queue.length })
  if (!isOpen) return null

  return (
    <div className={styles.queueContainer} onClick={onClose}>
      <div className={styles.queueModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Queue ({queue.length} tracks)</h2>
          <button onClick={onClose} className={styles.closeButton}>
            ×
          </button>
        </div>

        <div className={styles.content}>
          {queue.length === 0 ? (
            <div className={styles.empty}>
              <Music className={styles.emptyIcon} />
              <h3>Queue is empty</h3>
              <p>Add some tracks to get started</p>
            </div>
          ) : (
            <div className={styles.trackList}>
              {queue.map((track, index) => (
                <div
                  key={track.id}
                  className={`${styles.trackItem} ${draggedTrack === track.id ? styles.dragging : ''} ${dragTarget === track.id ? styles.dragTarget : ''} ${currentTrack && (typeof currentTrack === 'string' ? currentTrack === track.path : currentTrack.id === track.id) ? styles.currentTrack : ''}`}
                  draggable={canPerformAction('allowRemoveFromQueue')}
                  onDragStart={(e) => handleDragStart(e, track.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => handleDragEnter(e, track.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, track.id)}
                >
                  <div className={styles.dragHandle}>
                    <GripVertical className={styles.gripIcon} />
                  </div>
                  
                  <div className={styles.trackInfo}>
                    <div className={styles.trackNumber}>
                      {index + 1}
                    </div>
                    <div className={styles.trackDetails}>
                      <div className={styles.trackTitle}>
                        {track.title || getTrackName(track.path)}
                      </div>
                      <div className={styles.trackAlbum}>
                        {track.album || 'Unknown Album'}
                      </div>
                    </div>
                  </div>

                  <div className={styles.trackActions}>
                    <button
                      onClick={() => handlePlayTrack(track.id)}
                      className={styles.playButton}
                      disabled={!canPerformAction('allowAddToQueue')}
                      title={!canPerformAction('allowAddToQueue') ? 'Playing tracks is restricted in party mode' : 'Play now'}
                    >
                      <Play className={styles.playIcon} />
                    </button>
                    <button
                      onClick={() => handleRemoveTrack(track.id)}
                      className={styles.removeButton}
                      disabled={!canPerformAction('allowRemoveFromQueue')}
                      title={!canPerformAction('allowRemoveFromQueue') ? 'Removing from queue is restricted in party mode' : 'Remove from queue'}
                    >
                      <X className={styles.removeIcon} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 