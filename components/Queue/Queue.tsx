'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Play, X, GripVertical, Music, ChevronUp, ChevronDown } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { usePlayback } from '@/contexts/PlaybackContext'
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

export default function Queue({ isOpen, onClose }: QueueProps): JSX.Element | null {
  const { canPerformAction } = useSettings()
  const playback = usePlayback()
  const [queue, setQueue] = useState<QueueTrack[]>([])
  const [currentTrack, setCurrentTrack] = useState<string | CurrentTrack | null>(null)
  // const [isPlaying, setIsPlaying] = useState(false)
  const [draggedTrack, setDraggedTrack] = useState<string | null>(null)
  const [dragTarget, setDragTarget] = useState<string | null>(null)

  const loadQueue = useCallback(async (): Promise<void> => {
    try {
      const data = await playback.getState()
      if (data) {
        // console.log('Queue data loaded:', data)
        setQueue(data.queue ?? [])
        setCurrentTrack(data.currentTrack)
        // setIsPlaying(data.isPlaying)
      }
    } catch (error) {
      console.error('Error loading queue:', error)
    }
  }, [playback])

  useEffect(() => {
    if (isOpen) {
      void loadQueue()
      const interval = setInterval(() => { void loadQueue() }, 2000)
      return () => clearInterval(interval)
    }
  }, [isOpen, loadQueue])

  const handleRemoveTrack = async (trackId: string): Promise<void> => {
    if (!canPerformAction('allowRemoveFromQueue')) {
      console.error('Removing from queue is restricted in party mode')
      return
    }

    try {
      if (await playback.removeFromQueue(trackId)) {
        await loadQueue()
      } else {
        console.error('Failed to remove track from queue')
      }
    } catch (error) {
      console.error('Error removing track from queue:', error)
    }
  }

  const handlePlayTrack = async (trackId: string): Promise<void> => {
    if (!canPerformAction('allowAddToQueue')) {
      console.error('Playing tracks is restricted in party mode')
      return
    }

    try {
      if (await playback.playTrackNow(trackId)) {
        await loadQueue()
      } else {
        console.error('Failed to play track')
      }
    } catch (error) {
      console.error('Error playing track:', error)
    }
  }

  const handleMoveTrack = async (fromIndex: number, toIndex: number): Promise<void> => {
    if (!canPerformAction('allowRemoveFromQueue')) return
    if (toIndex < 0 || toIndex >= queue.length) return
    try {
      if (await playback.reorderQueue(queue[fromIndex].id, queue[toIndex].id)) await loadQueue()
    } catch (error) {
      console.error('Error reordering tracks:', error)
    }
  }

  const handleDragStart = (e: React.DragEvent, trackId: string): void => {
    // console.log('Drag start:', trackId)
    setDraggedTrack(trackId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', trackId)
  }

  const handleDragEnd = (_e: React.DragEvent): void => {
    // console.log('Drag end')
    setDraggedTrack(null)
    setDragTarget(null)
  }

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (e: React.DragEvent, trackId: string): void => {
    e.preventDefault()
    setDragTarget(trackId)
    ;(e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
  }

  const handleDragLeave = (e: React.DragEvent): void => {
    e.preventDefault()
    setDragTarget(null)
    ;(e.currentTarget as HTMLElement).style.backgroundColor = ''
  }

  const handleDrop = async (e: React.DragEvent, targetTrackId: string): Promise<void> => {
    e.preventDefault()
    setDragTarget(null)
    ;(e.currentTarget as HTMLElement).style.backgroundColor = ''
    
    // console.log('Drop event:', { draggedTrack, targetTrackId })
    
    if (!draggedTrack || draggedTrack === targetTrackId) {
      setDraggedTrack(null)
      return
    }

    if (!canPerformAction('allowRemoveFromQueue')) {
      console.error('Queue management is restricted in party mode')
      setDraggedTrack(null)
      return
    }

    try {
      // console.log('Sending reorder request:', { draggedTrack, targetTrackId })
      if (await playback.reorderQueue(draggedTrack, targetTrackId)) {
        // console.log('Reorder successful')
        await loadQueue()
      } else {
        console.error('Failed to reorder tracks')
      }
    } catch (error) {
      console.error('Error reordering tracks:', error)
    } finally {
      setDraggedTrack(null)
    }
  }

  const getTrackName = (path: string): string => {
    const pathParts = path.split('/')
    const filename = pathParts[pathParts.length - 1]
    return filename.replace(/\.[^/.]+$/, '')
  }

  // console.log('Queue component render:', { isOpen, queueLength: queue.length })
  if (!isOpen) return null

  return (
    <div
      className={styles.queueContainer}
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}
      tabIndex={0}
      role="button"
      aria-label="Close queue modal"
    >
      <div
        className={styles.queueModal}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') onClose() }}
        tabIndex={0}
        role="button"
        aria-label="Queue modal content"
      >
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
                  onDrop={(e) => { void handleDrop(e, track.id) }}
                >
                  <div className={styles.dragHandle}>
                    <GripVertical className={styles.gripIcon} />
                  </div>
                  
                  <div className={styles.trackInfo}>
                    <button
                      className={`${styles.trackNumber} ${styles.trackNumberBtn}`}
                      onClick={() => { void handlePlayTrack(track.id) }}
                      disabled={!canPerformAction('allowAddToQueue')}
                      title={!canPerformAction('allowAddToQueue') ? 'Playing tracks is restricted in party mode' : 'Play now'}
                    >
                      {index + 1}
                    </button>
                    <div className={styles.trackDetails}>
                      <div className={styles.trackTitle}>
                        {track.title || getTrackName(track.path)}
                      </div>
                      <div className={styles.trackAlbum}>
                        {track.artist ? `${track.artist} · ${track.album || 'Unknown Album'}` : (track.album || 'Unknown Album')}
                      </div>
                    </div>
                  </div>

                  <div className={styles.moveButtons}>
                    <button
                      onClick={() => { void handleMoveTrack(index, index - 1) }}
                      className={styles.moveButton}
                      disabled={index === 0 || !canPerformAction('allowRemoveFromQueue')}
                      title="Move up"
                    >
                      <ChevronUp className={styles.moveIcon} />
                    </button>
                    <button
                      onClick={() => { void handleMoveTrack(index, index + 1) }}
                      className={styles.moveButton}
                      disabled={index === queue.length - 1 || !canPerformAction('allowRemoveFromQueue')}
                      title="Move down"
                    >
                      <ChevronDown className={styles.moveIcon} />
                    </button>
                  </div>

                  <div className={styles.trackActions}>
                    <button
                      onClick={() => { void handlePlayTrack(track.id) }}
                      className={styles.playButton}
                      disabled={!canPerformAction('allowAddToQueue')}
                      title={!canPerformAction('allowAddToQueue') ? 'Playing tracks is restricted in party mode' : 'Play now'}
                    >
                      <Play className={styles.playIcon} />
                    </button>
                    <button
                      onClick={() => { void handleRemoveTrack(track.id) }}
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