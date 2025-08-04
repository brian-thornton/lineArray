'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Album } from '@/types/music'
import { Copy, Trash2 } from 'lucide-react'
import styles from './AdminAlbumManager.module.css'

interface AdminAlbumManagerProps {
  album: Album
  onCoverUpdated?: () => void
}

export default function AdminAlbumManager({ album, onCoverUpdated }: AdminAlbumManagerProps): JSX.Element {
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadAreaRef = useRef<HTMLDivElement>(null)

  const uploadImage = useCallback(async (file: File): Promise<void> => {
    if (!album.folderPath) {
      setUploadMessage('Error: Album folder path not available')
      return
    }

    console.log('Uploading to album path:', album.folderPath)
    console.log('File details:', { name: file.name, size: file.size, type: file.type, lastModified: file.lastModified })

    setIsUploading(true)
    setUploadMessage('')

    try {
      const formData = new FormData()
      formData.append('albumPath', album.folderPath)
      formData.append('image', file)
      formData.append('timestamp', Date.now().toString()) // Add timestamp to prevent caching

      const response = await fetch('/api/admin/upload-cover', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        await response.json()
        setUploadMessage('Cover art saved successfully!')
        
        // Force browser to reload all cover images by adding a cache-busting parameter
        const timestamp = Date.now().toString()
        const coverImages = document.querySelectorAll('img[src*="/api/cover/"]')
        coverImages.forEach((img) => {
          const imgElement = img as HTMLImageElement
          const url = new URL(imgElement.src)
          url.searchParams.set('t', timestamp)
          imgElement.src = url.toString()
        })
        
        // Also force reload of any Next.js Image components by triggering a re-render
        const nextImages = document.querySelectorAll('img[src*="/api/cover/"]')
        nextImages.forEach((img) => {
          const imgElement = img as HTMLImageElement
          if (imgElement.src.includes('/api/cover/')) {
            const url = new URL(imgElement.src)
            url.searchParams.set('t', timestamp)
            imgElement.src = url.toString()
          }
        })
        
        // Force a complete page refresh of cover images by dispatching a custom event
        window.dispatchEvent(new CustomEvent('coverImageUpdated', { 
          detail: { timestamp, albumPath: album.folderPath } 
        }))
        
        onCoverUpdated?.()
        
        // Clear message after 3 seconds
        setTimeout(() => setUploadMessage(''), 3000)
      } else {
        const error = await response.json() as { error: string }
        setUploadMessage(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error uploading cover art:', error)
      setUploadMessage('Error uploading cover art')
    } finally {
      setIsUploading(false)
    }
  }, [album.folderPath, onCoverUpdated])

  const handlePasteEvent = useCallback(async (e: ClipboardEvent | React.ClipboardEvent): Promise<void> => {
    e.preventDefault()
    
    console.log('Processing paste event...')
    
    const { clipboardData } = e
    if (!clipboardData) {
      console.log('No clipboard data available')
      setUploadMessage('No image found in clipboard')
      setTimeout(() => setUploadMessage(''), 3000)
      return
    }

    const { items } = clipboardData
    console.log('Paste event detected, items:', items.length)
    
    let imageFound = false
    
    for (const item of Array.from(items)) {
      console.log('Checking item type:', item.type)
      
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          console.log('Found image file:', file.name, 'size:', file.size, 'type:', file.type)
          imageFound = true
          
          // Create a new file with a unique name to prevent caching
          const uniqueFile = new File([file], `cover_${Date.now()}.jpg`, { type: file.type })
          await uploadImage(uniqueFile)
          break
        } else {
          console.log('Failed to get file from clipboard item')
        }
      }
    }
    
    if (!imageFound) {
      console.log('No image found in clipboard items')
      setUploadMessage('No image found in clipboard. Please copy an image first.')
      setTimeout(() => setUploadMessage(''), 3000)
    }
  }, [uploadImage])

  // Add global paste event listener
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent): void => {
      // Only handle paste if the upload area is focused or if we're in the admin area
      if (!uploadAreaRef.current?.contains(document.activeElement) && 
          !uploadAreaRef.current?.matches(':focus-within')) {
        return
      }

      console.log('Global paste event detected')
      void handlePasteEvent(e)
    }

    document.addEventListener('paste', handleGlobalPaste)
    return () => {
      document.removeEventListener('paste', handleGlobalPaste)
    }
  }, [handlePasteEvent])

  const handlePaste = (e: React.ClipboardEvent): void => {
    console.log('Local paste event triggered')
    void handlePasteEvent(e)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      await uploadImage(file)
    }
  }

  const triggerFileSelect = (): void => {
    fileInputRef.current?.click()
  }

  const copyAlbumName = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(album.title)
      setUploadMessage('Album name copied to clipboard!')
      setTimeout(() => setUploadMessage(''), 2000)
    } catch (error) {
      console.error('Failed to copy album name:', error)
      setUploadMessage('Failed to copy album name')
      setTimeout(() => setUploadMessage(''), 2000)
    }
  }

  const deleteCover = async (): Promise<void> => {
    if (!album.folderPath) {
      setUploadMessage('Error: Album folder path not available')
      return
    }

    // Use window.confirm for now - in a production app, you might want to use a modal
    // eslint-disable-next-line no-alert
    if (!window.confirm('Are you sure you want to delete the cover art for this album?')) {
      return
    }

    setIsDeleting(true)
    setUploadMessage('Deleting cover art...')

    try {
      const response = await fetch('/api/admin/delete-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          albumPath: album.folderPath 
        })
      })

      if (response.ok) {
        const result = await response.json() as { success: boolean; message: string }
        setUploadMessage(result.message)
        
        if (result.success) {
          // Force browser to reload all cover images
          const coverImages = document.querySelectorAll('img[src*="/api/cover/"]')
          coverImages.forEach((img) => {
            const imgElement = img as HTMLImageElement
            const url = new URL(imgElement.src)
            url.searchParams.set('t', Date.now().toString())
            imgElement.src = url.toString()
          })
          
          onCoverUpdated?.()
        }
        
        // Clear message after 3 seconds
        setTimeout(() => setUploadMessage(''), 3000)
      } else {
        const error = await response.json() as { error: string }
        setUploadMessage(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting cover art:', error)
      setUploadMessage('Error deleting cover art')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className={styles.adminManager}>
      <h3 className={styles.title}>Admin: Album Management</h3>
      
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Cover Art</h4>
        <p className={styles.description}>
          Paste an image from your clipboard or select a file to save as folder.jpg in the album directory.
        </p>
        
        <div 
          ref={uploadAreaRef}
          className={styles.uploadArea} 
          onPaste={handlePaste}
          tabIndex={0}
          role="button"
          aria-label="Upload area - paste image here or click to select file"
        >
          <div className={styles.uploadContent}>
            <div className={styles.uploadIcon}>📋</div>
            <p className={styles.uploadText}>
              Paste image from clipboard or click to select file
            </p>
            <button
              type="button"
              onClick={() => { triggerFileSelect(); }}
              disabled={isUploading}
              className={styles.selectButton}
            >
              Select Image File
            </button>

            <button
              type="button"
              onClick={() => { void deleteCover(); }}
              disabled={isDeleting || isUploading}
              className={styles.deleteButton}
            >
              <Trash2 size={16} />
              Delete Cover Art
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => { void handleFileSelect(e); }}
          style={{ display: 'none' }}
        />

        {(isUploading || isDeleting) && (
          <div className={styles.uploading}>
            <p>
              {isUploading ? 'Uploading cover art...' : 
               'Deleting cover art...'}
            </p>
          </div>
        )}

        {uploadMessage && (
          <div className={`${styles.message} ${uploadMessage.includes('Error') ? styles.error : styles.success}`}>
            {uploadMessage}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Album Info</h4>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Title:</span>
            <span className={styles.infoValue}>
              {album.title}
              <button
                type="button"
                onClick={() => { void copyAlbumName(); }}
                className={styles.copyButton}
                title="Copy album name to clipboard"
                aria-label="Copy album name to clipboard"
              >
                <Copy size={16} />
              </button>
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Artist:</span>
            <span className={styles.infoValue}>{album.artist}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Year:</span>
            <span className={styles.infoValue}>{album.year ?? 'Unknown'}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Tracks:</span>
            <span className={styles.infoValue}>{album.tracks.length}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Folder Path:</span>
            <span className={styles.infoValue}>{album.folderPath ?? 'Not available'}</span>
          </div>
        </div>
      </div>
    </div>
  )
} 