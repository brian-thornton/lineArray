'use client'

import React, { useState, useEffect } from 'react'
import MusicFoldersManager from '@/components/MusicFoldersManager'
import ScanProgress from '@/components/ScanProgress'
import PinPad from '@/components/PinPad'
import PlayCounts from '@/components/PlayCounts'
import LogsViewer from '@/components/LogsViewer'
import { useSettings } from '@/contexts/SettingsContext'
import { useTheme } from '@/contexts/ThemeContext'
import styles from './page.module.css'

export default function SettingsPage(): JSX.Element {
  const { settings, updateSettings } = useSettings()
  const { themes, setTheme } = useTheme()
  const [jukeboxName, setJukeboxName] = useState(settings.jukeboxName)
  const [partyMode, setPartyMode] = useState(settings.partyMode)
  const [selectedTheme, setSelectedTheme] = useState(settings.theme)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [partyModeMessage, setPartyModeMessage] = useState('')
  const [pinMessage, setPinMessage] = useState('')
  const [themeMessage, setThemeMessage] = useState('')
  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [scanProgress, setScanProgress] = useState({
    isVisible: false,
    currentFile: '',
    scannedFiles: 0,
    totalFiles: 0,
    currentAlbum: ''
  })
  const [isScanning, setIsScanning] = useState(false)
  const [currentPaths, setCurrentPaths] = useState<string[]>([])
  const [scanResults, setScanResults] = useState<{ [path: string]: { albums: number; files: number; lastScanned: string } }>({})

  useEffect(() => {
    setJukeboxName(settings.jukeboxName)
    setPartyMode(settings.partyMode)
    setSelectedTheme(settings.theme)
    void loadCurrentPaths()
  }, [settings.jukeboxName, settings.partyMode, settings.theme])

  useEffect(() => {
    // Check if party mode is enabled and user is not authenticated
    if (settings.partyMode.enabled && !isAuthenticated) {
      setShowPinModal(true)
    } else {
      setShowPinModal(false)
    }
  }, [settings.partyMode.enabled, isAuthenticated])

  const loadCurrentPaths = async (): Promise<void> => {
    try {
      const response = await fetch('/api/albums')
      if (response.ok) {
        const data = await response.json() as { scanPaths?: string[]; scanResults?: { [path: string]: { albums: number; files: number; lastScanned: string } } }
        setCurrentPaths(data.scanPaths ?? [])
        setScanResults(data.scanResults ?? {})
      }
    } catch (error) {
      console.error('Error loading current paths:', error)
    }
  }

  const handlePinSubmit = async (): Promise<void> => {
    if (pin.length < 4) return
    
    setPinError('')
    
    try {
      const response = await fetch('/api/settings/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      })
      
      if (response.ok) {
        setIsAuthenticated(true)
        setShowPinModal(false)
        setPin('')
      } else {
        const data = await response.json() as { error?: string }
        setPinError(data.error ?? 'Invalid PIN')
        setPin('')
      }
    } catch (error) {
      console.error('Error verifying PIN:', error)
      setPinError('Failed to verify PIN')
      setPin('')
    }
  }

  const handlePinCancel = (): void => {
    // Redirect back to home page if user cancels PIN entry
    window.history.back()
  }

  const handleSaveSettings = async (): Promise<void> => {
    setIsSaving(true)
    setSaveMessage('')
    
    try {
      await updateSettings({
        jukeboxName: jukeboxName.trim() ?? 'Jukebox 2.0',
        partyMode
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

  const handleSavePartyMode = async (): Promise<void> => {
    setIsSaving(true)
    setPartyModeMessage('')
    
    try {
      await updateSettings({
        partyMode
      })
      setPartyModeMessage('Party mode settings saved successfully!')
      setTimeout(() => setPartyModeMessage(''), 3000)
    } catch (error) {
      console.error('Error saving party mode settings:', error)
      setPartyModeMessage('Failed to save party mode settings')
      setTimeout(() => setPartyModeMessage(''), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePartyModeToggle = (key: keyof typeof partyMode): void => {
    setPartyMode(prev => {
      const newPartyMode = {
        ...prev,
        [key]: !prev[key]
      }
      return newPartyMode
    })
  }

  const handleScan = async (directories: string[]): Promise<void> => {
    setIsScanning(true)
    setCurrentPaths(directories)
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
        body: JSON.stringify({ directories }),
      })
      
      if (response.ok) {
        const result = await response.json() as { scanResults?: { [path: string]: { albums: number; files: number; lastScanned: string } }; totalFiles?: number; totalAlbums?: number }
        setScanResults(result.scanResults ?? {})
        setScanProgress(prev => ({
          ...prev,
          currentFile: 'Scan completed!',
          scannedFiles: result.totalFiles ?? 0,
          totalFiles: result.totalFiles ?? 0,
          currentAlbum: `Found ${result.totalAlbums ?? 0} albums across ${directories.length} folders`
        }))
        setTimeout(() => {
          setScanProgress(prev => ({ ...prev, isVisible: false }))
        }, 2000)
      } else {
        const error = await response.json() as { error?: string }
        console.error(`Scan failed: ${error.error}`)
        setScanProgress(prev => ({ ...prev, isVisible: false }))
      }
    } catch (error) {
      console.error('Scan failed. Please try again.')
      setScanProgress(prev => ({ ...prev, isVisible: false }))
    } finally {
      setIsScanning(false)
    }
  }

  const handleSavePin = async (): Promise<void> => {
    setIsSaving(true)
    setPinMessage('')
    
    try {
      await updateSettings({
        adminPin: settings.adminPin ?? '1234'
      })
      setPinMessage('PIN saved successfully!')
      setTimeout(() => setPinMessage(''), 3000)
    } catch (error) {
      console.error('Error saving PIN:', error)
      setPinMessage('Failed to save PIN')
      setTimeout(() => setPinMessage(''), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveTheme = async (): Promise<void> => {
    setIsSaving(true)
    setThemeMessage('')
    
    try {
      await updateSettings({
        theme: selectedTheme
      })
      setTheme(selectedTheme)
      setThemeMessage('Theme saved successfully!')
      setTimeout(() => setThemeMessage(''), 3000)
    } catch (error) {
      console.error('Error saving theme:', error)
      setThemeMessage('Failed to save theme')
      setTimeout(() => setThemeMessage(''), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  // If party mode is enabled and user is not authenticated, show PIN modal
  if (settings.partyMode.enabled && !isAuthenticated) {
    return (
      <div className={styles.container}>
        {showPinModal && (
          <div className={styles.pinModalOverlay}>
            <div className={styles.pinModal}>
              <h2 className={styles.pinModalTitle}>Settings Protected</h2>
              <p className={styles.pinModalDescription}>
                Party mode is enabled. Please enter the admin PIN to access settings.
              </p>
              
              <PinPad
                pin={pin}
                onPinChange={setPin}
                maxLength={6}
                disabled={false}
              />
              
              {pinError && (
                <div className={styles.pinError}>{pinError}</div>
              )}
              
              <div className={styles.pinActions}>
                <button
                  type="button"
                  onClick={handlePinCancel}
                  className={styles.pinCancelButton}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { void handlePinSubmit(); }}
                  className={styles.pinSubmitButton}
                  disabled={pin.length < 4}
                >
                  Access Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
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
            onClick={() => { void handleSaveSettings(); }}
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
        <h2 className={styles.sectionTitle}>Admin PIN</h2>
        <p className={styles.description}>
          Set an admin PIN to protect settings access when party mode is enabled. Default PIN is &quot;1234&quot;.
        </p>
        <div className={styles.setting}>
          <label htmlFor="adminPin" className={styles.label}>
            Admin PIN
          </label>
          <input
            id="adminPin"
            type="password"
            value={settings.adminPin ?? ''}
            onChange={(e) => { void updateSettings({ adminPin: e.target.value }); }}
            className={styles.input}
            placeholder="Enter admin PIN (min 4 digits)"
            maxLength={10}
            pattern="[0-9]*"
          />
          <button
            onClick={() => { void handleSavePin(); }}
            disabled={isSaving}
            className={styles.saveButton}
          >
            {isSaving ? 'Saving...' : 'Save PIN'}
          </button>
        </div>
        {pinMessage && (
          <div className={`${styles.message} ${pinMessage.includes('success') ? styles.success : styles.error}`}>
            {pinMessage}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Theme Selection</h2>
        <p className={styles.description}>
          Choose your preferred color theme for the jukebox interface.
        </p>
        <div className={styles.setting}>
          <label htmlFor="theme" className={styles.label}>
            Theme
          </label>
          <select
            id="theme"
            value={selectedTheme}
            onChange={(e) => setSelectedTheme(e.target.value)}
            className={styles.select}
          >
            {themes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => { void handleSaveTheme(); }}
            disabled={isSaving}
            className={styles.saveButton}
          >
            {isSaving ? 'Saving...' : 'Save Theme'}
          </button>
        </div>
        {selectedTheme && (
          <div className={styles.themePreview}>
            <p><strong>Current Theme:</strong> {themes.find(t => t.id === selectedTheme)?.name}</p>
            <p className={styles.themeDescription}>
              {themes.find(t => t.id === selectedTheme)?.description}
            </p>
          </div>
        )}
        {themeMessage && (
          <div className={`${styles.message} ${themeMessage.includes('success') ? styles.success : styles.error}`}>
            {themeMessage}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Party Mode Controls</h2>
        <p className={styles.description}>
          Enable party mode to restrict certain features and prevent unwanted changes during events.
        </p>
        
        <div className={styles.partyModeGrid}>
          <div className={styles.partyModeSection}>
            <h3 className={styles.subsectionTitle}>Party Mode</h3>
            <div className={styles.toggleSetting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={partyMode.enabled}
                  onChange={() => handlePartyModeToggle('enabled')}
                  className={styles.toggle}
                />
                <span className={styles.toggleText}>Enable Party Mode</span>
              </label>
            </div>
          </div>

          <div className={styles.partyModeSection}>
            <h3 className={styles.subsectionTitle}>Playback Controls</h3>
            <div className={styles.toggleSetting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={partyMode.allowPlay}
                  onChange={() => handlePartyModeToggle('allowPlay')}
                  className={styles.toggle}
                  disabled={!partyMode.enabled}
                />
                <span className={styles.toggleText}>Allow Play</span>
              </label>
            </div>
            <div className={styles.toggleSetting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={partyMode.allowStop}
                  onChange={() => handlePartyModeToggle('allowStop')}
                  className={styles.toggle}
                  disabled={!partyMode.enabled}
                />
                <span className={styles.toggleText}>Allow Stop</span>
              </label>
            </div>
            <div className={styles.toggleSetting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={partyMode.allowNext}
                  onChange={() => handlePartyModeToggle('allowNext')}
                  className={styles.toggle}
                  disabled={!partyMode.enabled}
                />
                <span className={styles.toggleText}>Allow Next Track</span>
              </label>
            </div>
            <div className={styles.toggleSetting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={partyMode.allowPrevious}
                  onChange={() => handlePartyModeToggle('allowPrevious')}
                  className={styles.toggle}
                  disabled={!partyMode.enabled}
                />
                <span className={styles.toggleText}>Allow Previous Track</span>
              </label>
            </div>
          </div>

          <div className={styles.partyModeSection}>
            <h3 className={styles.subsectionTitle}>Playlist Management</h3>
            <div className={styles.toggleSetting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={partyMode.allowCreatePlaylists}
                  onChange={() => handlePartyModeToggle('allowCreatePlaylists')}
                  className={styles.toggle}
                  disabled={!partyMode.enabled}
                />
                <span className={styles.toggleText}>Allow Create Playlists</span>
              </label>
            </div>
            <div className={styles.toggleSetting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={partyMode.allowEditPlaylists}
                  onChange={() => handlePartyModeToggle('allowEditPlaylists')}
                  className={styles.toggle}
                  disabled={!partyMode.enabled}
                />
                <span className={styles.toggleText}>Allow Edit Playlists</span>
              </label>
            </div>
            <div className={styles.toggleSetting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={partyMode.allowDeletePlaylists}
                  onChange={() => handlePartyModeToggle('allowDeletePlaylists')}
                  className={styles.toggle}
                  disabled={!partyMode.enabled}
                />
                <span className={styles.toggleText}>Allow Delete Playlists</span>
              </label>
            </div>
          </div>

          <div className={styles.partyModeSection}>
            <h3 className={styles.subsectionTitle}>Queue Management</h3>
            <div className={styles.toggleSetting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={partyMode.allowAddToQueue}
                  onChange={() => handlePartyModeToggle('allowAddToQueue')}
                  className={styles.toggle}
                  disabled={!partyMode.enabled}
                />
                <span className={styles.toggleText}>Allow Add to Queue</span>
              </label>
            </div>
            <div className={styles.toggleSetting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={partyMode.allowRemoveFromQueue}
                  onChange={() => handlePartyModeToggle('allowRemoveFromQueue')}
                  className={styles.toggle}
                  disabled={!partyMode.enabled}
                />
                <span className={styles.toggleText}>Allow Remove from Queue</span>
              </label>
            </div>
            <div className={styles.toggleSetting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={partyMode.allowSkipInQueue}
                  onChange={() => handlePartyModeToggle('allowSkipInQueue')}
                  className={styles.toggle}
                  disabled={!partyMode.enabled}
                />
                <span className={styles.toggleText}>Allow Skip in Queue</span>
              </label>
            </div>
          </div>
        </div>
        <button
          onClick={() => { void handleSavePartyMode(); }}
          disabled={isSaving}
          className={styles.saveButton}
        >
          {isSaving ? 'Saving...' : 'Save Party Mode Settings'}
        </button>
        {partyModeMessage && (
          <div className={`${styles.message} ${partyModeMessage.includes('success') ? styles.success : styles.error}`}>
            {partyModeMessage}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Music Library Scan</h2>
        <MusicFoldersManager 
          onScan={(directories) => { void handleScan(directories); }}
          isScanning={isScanning}
          currentPaths={currentPaths}
          scanResults={scanResults}
        />
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Play Statistics</h2>
        <PlayCounts />
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>System Logs</h2>
        <LogsViewer />
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