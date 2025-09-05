import React from 'react'
import { Loader, Music, Folder, X } from 'lucide-react'
import styles from './ScanProgress.module.css'

interface ScanProgressProps {
  isVisible: boolean
  currentFile?: string
  scannedFiles: number
  totalFiles?: number
  currentAlbum?: string
  onCancel?: () => void
  consoleMessages?: Array<{
    type: string
    message: string
    timestamp: number
  }>
}

export default function ScanProgress({
  isVisible,
  currentFile,
  scannedFiles,
  totalFiles,
  currentAlbum,
  onCancel,
  consoleMessages = []
}: ScanProgressProps): JSX.Element | null {
  if (!isVisible) return null

  const progress = totalFiles ? (scannedFiles / totalFiles) * 100 : 0

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          {onCancel && (
            <button
              onClick={onCancel}
              className={styles.cancelButton}
              aria-label="Cancel scan"
            >
              <X size={20} />
            </button>
          )}
          <div className={styles.spinnerContainer}>
            <Loader className={styles.spinner} />
          </div>
          <h2 className={styles.title}>Scanning Music Library</h2>
          <p className={styles.subtitle}>Please wait while we index your music collection...</p>
        </div>

        <div className={styles.progressSection}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progress}%` }}
             />
          </div>
          
          <div className={styles.stats}>
            <div className={styles.stat}>
              <Music className={styles.statIcon} />
              <span className={styles.statLabel}>Files Scanned:</span>
              <span className={styles.statValue}>{scannedFiles}</span>
            </div>
            
            {totalFiles && (
              <div className={styles.stat}>
                <Folder className={styles.statIcon} />
                <span className={styles.statLabel}>Total Files:</span>
                <span className={styles.statValue}>{totalFiles}</span>
              </div>
            )}
          </div>
        </div>

        {currentFile && (
          <div className={styles.currentFile}>
            <h3 className={styles.currentTitle}>Currently Processing:</h3>
            <div className={styles.fileInfo}>
              <span className={styles.fileName}>{currentFile}</span>
              {currentAlbum && (
                <span className={styles.albumName}>Album: {currentAlbum}</span>
              )}
            </div>
          </div>
        )}

        <div className={styles.tips}>
          <p className={styles.tip}>
            💡 Tip: The scan will automatically detect album folders and extract metadata from your music files.
          </p>
        </div>

        {consoleMessages.length > 0 && (
          <div className={styles.console}>
            <h3 className={styles.consoleTitle}>Scan Console</h3>
            <div className={styles.consoleContent}>
              {consoleMessages.slice(-10).map((msg, index) => (
                <div key={index} className={`${styles.consoleLine} ${styles[`consoleLine_${msg.type}`]}`}>
                  <span className={styles.consoleTimestamp}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={styles.consoleMessage}>{msg.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 