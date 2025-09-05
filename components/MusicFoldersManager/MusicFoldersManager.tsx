"use client"

import { useState, useEffect } from 'react'
import { Folder, X, Plus, FolderOpen, RotateCcw, AlertTriangle } from 'lucide-react'
import FileBrowser from '../FileBrowser/FileBrowser'
import styles from './MusicFoldersManager.module.css'

interface MusicFoldersManagerProps {
  onScan: (directories: string[]) => void
  onRescanSingle: (directory: string) => void
  isScanning: boolean
  currentPaths: string[]
  scanResults: { [path: string]: { albums: number; files: number; lastScanned: string; status?: string; reason?: string } }
}

export default function MusicFoldersManager({ 
  onScan, 
  onRescanSingle,
  isScanning, 
  currentPaths, 
  scanResults 
}: MusicFoldersManagerProps): JSX.Element {
  const [folders, setFolders] = useState<string[]>(currentPaths)
  const [newFolder, setNewFolder] = useState('')
  const [showFileBrowser, setShowFileBrowser] = useState(false)

  useEffect(() => {
    setFolders(currentPaths)
  }, [currentPaths])

  const handleAddFolder = (): void => {
    if (newFolder.trim() && !folders.includes(newFolder.trim())) {
      const updatedFolders = [...folders, newFolder.trim()]
      setFolders(updatedFolders)
      setNewFolder('')
    }
  }

  const handleRemoveFolder = (index: number): void => {
    const updatedFolders = folders.filter((_, i) => i !== index)
    setFolders(updatedFolders)
  }

  const handleScanAll = (): void => {
    if (folders.length > 0) {
      onScan(folders)
    }
  }

  const handleRescanSingle = (folder: string): void => {
    onRescanSingle(folder)
  }

  const handleKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      handleAddFolder()
    }
  }

  const handleBrowseClick = (): void => {
    setShowFileBrowser(true)
  }

  const handleFileBrowserSelect = (path: string): void => {
    if (!folders.includes(path)) {
      const updatedFolders = [...folders, path]
      setFolders(updatedFolders)
    }
    setShowFileBrowser(false)
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString()
  }

  return showFileBrowser ? (
    <FileBrowser
      isOpen={true}
      onClose={() => setShowFileBrowser(false)}
      onSelectPath={handleFileBrowserSelect}
    />
  ) : (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Music Folders</h3>
        <button
          onClick={handleScanAll}
          disabled={isScanning || folders.length === 0}
          className={styles.scanAllButton}
        >
          {isScanning ? 'Scanning...' : `Scan All (${folders.length})`}
        </button>
      </div>

      <div className={styles.addSection}>
        <div className={styles.inputGroup}>
          <input
            type="text"
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter music folder path..."
            className={styles.input}
            disabled={isScanning}
          />
          <button
            onClick={handleAddFolder}
            disabled={!newFolder.trim() || isScanning}
            className={styles.addButton}
          >
            <Plus size={16} />
          </button>
          <button
            onClick={handleBrowseClick}
            disabled={isScanning}
            className={styles.browseButton}
          >
            <FolderOpen size={16} />
          </button>
        </div>
      </div>

      <div className={styles.foldersList}>
        {folders.length === 0 ? (
          <div className={styles.emptyState}>
            <Folder size={48} className={styles.emptyIcon} />
            <p>No music folders added yet</p>
            <p className={styles.emptySubtext}>Add folders to start scanning your music library</p>
          </div>
        ) : (
          folders.map((folder) => {
            const result = scanResults[folder]
            const isUnavailable = result?.status === 'unavailable'
            const folderItemClass = isUnavailable ? `${styles.folderItem} ${styles.folderItemUnavailable}` : styles.folderItem
            
            return (
              <div key={folder} className={folderItemClass}>
                <div className={styles.folderInfo}>
                  <div className={styles.folderIconContainer}>
                    <Folder size={20} className={`${styles.folderIcon} ${isUnavailable ? styles.folderIconUnavailable : ''}`} />
                    {isUnavailable && (
                      <AlertTriangle size={12} className={styles.warningIcon} />
                    )}
                  </div>
                  <div className={styles.folderDetails}>
                    <span className={`${styles.folderPath} ${isUnavailable ? styles.folderPathUnavailable : ''}`}>
                      {folder}
                    </span>
                    {result && (
                      <div className={`${styles.folderStats} ${isUnavailable ? styles.folderStatsUnavailable : ''}`}>
                        {isUnavailable ? (
                          <>
                            <span>Unavailable</span>
                            {result.reason && (
                              <>
                                <span>•</span>
                                <span>{result.reason}</span>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <span>{result.albums} albums</span>
                            <span>•</span>
                            <span>{result.files} tracks</span>
                            <span>•</span>
                            <span>Last scanned: {formatDate(result.lastScanned)}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.folderActions}>
                  <button
                    onClick={() => handleRescanSingle(folder)}
                    disabled={isScanning || isUnavailable}
                    className={`${styles.rescanButton} ${isUnavailable ? styles.rescanButtonDisabled : ''}`}
                    aria-label={isUnavailable ? "Cannot rescan unavailable folder" : "Rescan this folder"}
                    title={isUnavailable ? "Cannot rescan unavailable folder" : "Rescan this folder"}
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    onClick={() => handleRemoveFolder(folders.indexOf(folder))}
                    disabled={isScanning}
                    className={styles.removeButton}
                    aria-label="Remove folder"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
} 