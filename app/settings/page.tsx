'use client'

import React, { useState, useEffect } from 'react'
import ScanButton from '@/components/ScanButton'
import ScanProgress from '@/components/ScanProgress'
import { useSettings } from '@/contexts/SettingsContext'
import styles from './page.module.css'

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings()
  const [jukeboxName, setJukeboxName] = useState(settings.jukeboxName)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [scanProgress, setScanProgress] = useState({
    isVisible: false,
    currentFile: '',
    scannedFiles: 0,
    totalFiles: 0,
    currentAlbum: ''
  })
  const [isScanning, setIsScanning] = useState(false)
  const [currentPath, setCurrentPath] = useState('')

  useEffect(() => {
    setJukeboxName(settings.jukeboxName)
  }, [settings.jukeboxName])

  const handleSaveSettings = async () => {
    setIsSaving(true)
    setSaveMessage('')
    
    try {
      await updateSettings({
        jukeboxName: jukeboxName.trim() || 'Jukebox 2.0'
      })
      setSaveMessage('Settings saved successfully!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Error saving settings:', error)
      setSaveMessage('Failed to save settings')
      setTimeout(() => setSaveMessage(''), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleScan = async (path: string) => {
    setIsScanning(true)
    setCurrentPath(path)
    setScanProgress({
      isVisible: true,
      currentFile: '',
      scannedFiles: 0,
      totalFiles: 0,
      currentAlbum: ''
    })
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: path }),
      })
      if (response.ok) {
        const result = await response.json()
        setScanProgress(prev => ({
          ...prev,
          currentFile: 'Scan completed!',
          scannedFiles: result.totalFiles || 0,
          totalFiles: result.totalFiles || 0,
          currentAlbum: `Found ${result.totalAlbums || 0} albums`
        }))
        setTimeout(() => {
          setScanProgress(prev => ({ ...prev, isVisible: false }))
        }, 2000)
      } else {
        const error = await response.json()
        alert(`Scan failed: ${error.error}`)
        setScanProgress(prev => ({ ...prev, isVisible: false }))
      }
    } catch (error) {
      alert('Scan failed. Please try again.')
      setScanProgress(prev => ({ ...prev, isVisible: false }))
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Settings</h1>
      
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Jukebox Configuration</h2>
        <div className={styles.setting}>
          <label htmlFor="jukeboxName" className={styles.label}>
            Jukebox Name
          </label>
          <input
            id="jukeboxName"
            type="text"
            value={jukeboxName}
            onChange={(e) => setJukeboxName(e.target.value)}
            className={styles.input}
            placeholder="Enter jukebox name..."
            maxLength={50}
          />
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className={styles.saveButton}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
        {saveMessage && (
          <div className={`${styles.message} ${saveMessage.includes('success') ? styles.success : styles.error}`}>
            {saveMessage}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Music Library Scan</h2>
        <ScanButton 
          onScan={handleScan}
          isScanning={isScanning}
          currentPath={currentPath}
        />
      </div>
      
      <ScanProgress
        isVisible={scanProgress.isVisible}
        currentFile={scanProgress.currentFile}
        scannedFiles={scanProgress.scannedFiles}
        totalFiles={scanProgress.totalFiles}
        currentAlbum={scanProgress.currentAlbum}
      />
    </div>
  )
} 