import React, { useState } from 'react'
import { FolderOpen, Loader, Folder } from 'lucide-react'
import FileBrowser from '../FileBrowser'
import styles from './ScanButton.module.css'

interface ScanButtonProps {
  onScan: (path: string) => void
  isScanning: boolean
  currentPath: string
}

export default function ScanButton({ onScan, isScanning, currentPath }: ScanButtonProps): JSX.Element {
  const [showPathInput, setShowPathInput] = useState(false)
  const [showFileBrowser, setShowFileBrowser] = useState(false)
  const [inputPath, setInputPath] = useState('')

  const handleScanClick = (): void => {
    if (showPathInput && inputPath.trim()) {
      onScan(inputPath.trim())
      setShowPathInput(false)
      setInputPath('')
    } else {
      setShowPathInput(true)
    }
  }

  const handleCancel = (): void => {
    setShowPathInput(false)
    setInputPath('')
  }

  const handleBrowseClick = (): void => {
    setShowFileBrowser(true)
  }

  const handleFileBrowserSelect = (path: string): void => {
    setInputPath(path)
    setShowPathInput(true)
  }

  return (
    <div className={styles.container}>
      {currentPath && (
        <div className={styles.currentPath}>
          <span>Current Library:</span>
          <span className={styles.path}>{currentPath}</span>
        </div>
      )}
      
      <div className={styles.scanSection}>
        {showPathInput ? (
          <div className={styles.inputGroup}>
            <input
              type="text"
              value={inputPath}
              onChange={(e) => setInputPath(e.target.value)}
              placeholder="Enter music directory path..."
              className={styles.pathInput}
              disabled={isScanning}
            />
            <button
              onClick={handleScanClick}
              disabled={isScanning || !inputPath.trim()}
              className={`${styles.scanButton} ${styles.primary}`}
            >
              {isScanning ? (
                <>
                  <Loader className={styles.spinner} />
                  Scanning...
                </>
              ) : (
                'Scan'
              )}
            </button>
            <button
              onClick={handleCancel}
              disabled={isScanning}
              className={`${styles.scanButton} ${styles.secondary}`}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className={styles.buttonGroup}>
            <button
              onClick={handleScanClick}
              disabled={isScanning}
              className={`${styles.scanButton} ${styles.primary}`}
            >
              {isScanning ? (
                <>
                  <Loader className={styles.spinner} />
                  Scanning...
                </>
              ) : (
                <>
                  <FolderOpen className={styles.icon} />
                  {currentPath ? 'Rescan Library' : 'Scan Music Library'}
                </>
              )}
            </button>
            <button
              onClick={handleBrowseClick}
              disabled={isScanning}
              className={`${styles.scanButton} ${styles.browse}`}
            >
              <Folder className={styles.icon} />
              Browse
            </button>
          </div>
        )}
      </div>

      <FileBrowser
        isOpen={showFileBrowser}
        onClose={() => setShowFileBrowser(false)}
        onSelectPath={handleFileBrowserSelect}
      />
    </div>
  )
} 