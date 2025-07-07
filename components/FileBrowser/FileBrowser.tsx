import React, { useState, useEffect } from 'react'
import { Folder, Home, Monitor, FileText, Music } from 'lucide-react'
import styles from './FileBrowser.module.css'

interface FileBrowserProps {
  onSelectPath: (path: string) => void
  isOpen: boolean
  onClose: () => void
}

interface FileItem {
  name: string
  path: string
  isDirectory: boolean
  isExpanded?: boolean
  children?: FileItem[]
}

function FileBrowser({ onSelectPath, isOpen, onClose }: FileBrowserProps): JSX.Element | null {
  const [currentPath, setCurrentPath] = useState('')
  const [items, setItems] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Common system directories
  const systemDirectories = [
    { name: 'Home', path: process.env.HOME ?? '/Users', icon: Home },
    { name: 'Desktop', path: `${process.env.HOME ?? '/Users'}/Desktop`, icon: Monitor },
    { name: 'Documents', path: `${process.env.HOME ?? '/Users'}/Documents`, icon: FileText },
    { name: 'Music', path: `${process.env.HOME ?? '/Users'}/Music`, icon: Music },
  ]

  useEffect(() => {
    if (isOpen) {
      void loadSystemDirectories()
    }
  }, [isOpen])

  const loadSystemDirectories = async (): Promise<void> => {
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/browse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: '' }),
      })
      
      if (response.ok) {
        const data = await response.json() as { items: FileItem[] }
        setItems(data.items || [])
        setCurrentPath('')
      } else {
        setError('Failed to load directories')
      }
    } catch (error) {
      setError('Failed to load directories')
    } finally {
      setLoading(false)
    }
  }

  const loadDirectory = async (path: string): Promise<void> => {
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/browse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path }),
      })
      
      if (response.ok) {
        const data = await response.json() as { items: FileItem[] }
        setItems(data.items || [])
        setCurrentPath(path)
      } else {
        setError('Failed to load directory')
      }
    } catch (error) {
      setError('Failed to load directory')
    } finally {
      setLoading(false)
    }
  }

  const handleItemClick = async (item: FileItem): Promise<void> => {
    if (item.isDirectory) {
      await loadDirectory(item.path)
    }
  }

  const handleSelectDirectory = (path: string): void => {
    onSelectPath(path)
    onClose()
  }

  const handleSystemDirectoryClick = async (systemDir: { name: string; path: string; icon: React.ComponentType<{ className?: string }> }): Promise<void> => {
    await loadDirectory(systemDir.path)
  }

  const handleBackClick = async (): Promise<void> => {
    if (currentPath) {
      const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
      await loadDirectory(parentPath)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}
      tabIndex={0}
      role="button"
      aria-label="Close file browser modal"
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') onClose() }}
        tabIndex={0}
        role="button"
        aria-label="File browser modal content"
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Browse Music Directory</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.systemDirectories}>
            <h3 className={styles.sectionTitle}>Quick Access</h3>
            <div className={styles.systemGrid}>
              {systemDirectories.map((dir) => {
                const Icon = dir.icon
                return (
                  <button
                    key={dir.path}
                    className={styles.systemButton}
                    onClick={() => { void handleSystemDirectoryClick(dir) }}
                  >
                    <Icon className={styles.systemIcon} />
                    <span>{dir.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className={styles.browser}>
            <div className={styles.pathBar}>
              <button
                className={styles.backButton}
                onClick={() => { void handleBackClick() }}
                disabled={!currentPath}
              >
                ← Back
              </button>
              <div className={styles.currentPath}>
                {currentPath || 'System Directories'}
              </div>
            </div>

            {error && (
              <div className={styles.error}>
                {error}
              </div>
            )}

            {loading ? (
              <div className={styles.loading}>
                <div className={styles.spinner} />
                Loading...
              </div>
            ) : (
              <div className={styles.fileList}>
                {items.map((item) => (
                  <div
                    key={item.path}
                    className={styles.fileItem}
                    onClick={() => { void handleItemClick(item) }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open ${item.name}`}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') void handleItemClick(item) }}
                  >
                    <div className={styles.fileIcon}>
                      {item.isDirectory ? (
                        <Folder className={styles.folderIcon} />
                      ) : (
                        <div className={styles.fileIconPlaceholder} />
                      )}
                    </div>
                    <div className={styles.fileInfo}>
                      <span className={styles.fileName}>{item.name}</span>
                      {item.isDirectory && (
                        <span className={styles.fileType}>Folder</span>
                      )}
                    </div>
                    {item.isDirectory && (
                      <button
                        className={styles.selectButton}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectDirectory(item.path)
                        }}
                      >
                        Select
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FileBrowser 