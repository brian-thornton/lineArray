'use client'

import React from 'react'
import { Volume2, VolumeX, X } from 'lucide-react'
import styles from './VolumeModal.module.css'
import { useDialogFocus } from '@/hooks/useDialogFocus'

interface VolumeModalProps {
  isOpen: boolean
  onClose: () => void
  volume: number
  isMuted: boolean
  onVolumeChange: (volume: number) => void
  onMuteToggle: () => void
}

function VolumeModal({ 
  isOpen, 
  onClose, 
  volume, 
  isMuted, 
  onVolumeChange, 
  onMuteToggle 
}: VolumeModalProps): JSX.Element | null {
  const dialogRef = useDialogFocus(isOpen)

  if (!isOpen) return null

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onVolumeChange(parseFloat(e.target.value))
  }

  const handleMuteToggle = (): void => {
    onMuteToggle()
  }

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}
      role="presentation"
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') onClose() }}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="volume-title"
      >
        <div className={styles.header}>
          <h3 id="volume-title" className={styles.title}>Volume Control</h3>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">
            <X className={styles.closeIcon} />
          </button>
        </div>
        
        <div className={styles.content}>
          <div className={styles.volumeSection}>
            <div className={styles.volumeHeader}>
              <button
                onClick={handleMuteToggle}
                className={styles.muteButton}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className={styles.volumeIcon} /> : <Volume2 className={styles.volumeIcon} />}
              </button>
              <span className={styles.volumeLabel}>
                {isMuted ? 'Muted' : `${Math.round(volume * 100)}%`}
              </span>
            </div>
            
            <div className={styles.volumeSlider}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className={styles.slider}
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VolumeModal 