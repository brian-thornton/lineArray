'use client'

import React, { useState, useEffect } from 'react'
import { useSettings } from '@/contexts/SettingsContext'
import { useSearch } from '@/contexts/SearchContext'
import { useToast } from '@/contexts/ToastContext'
import SearchResults from '@/components/SearchResults/SearchResults'
import styles from './page.module.css'
import { useThemeContext } from '@/contexts/ThemeContext'
import MusicFoldersManager from '@/components/MusicFoldersManager/MusicFoldersManager'
import ScanProgress from '@/components/ScanProgress/ScanProgress'
import PinPad from '@/components/PinPad/PinPad'
import PlayCounts from '@/components/PlayCounts/PlayCounts'
import LogsViewer from '@/components/LogsViewer/LogsViewer'
import { Settings, Palette, PartyPopper, BarChart3 } from 'lucide-react'


type SettingsSection = 'admin' | 'ui' | 'party' | 'statistics'

interface SectionConfig {
  id: SettingsSection
  name: string
  icon: React.ComponentType<{ size?: number | string; className?: string }>
}

export default function SettingsPage(): JSX.Element {
  const { settings } = useSettings()
  const { searchQuery, searchResults, isSearching, addTrackToQueue, hideKeyboard } = useSearch()
  const { showToast } = useToast()
  const [activeSection, setActiveSection] = useState<SettingsSection>('admin')
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)




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

  // If there's an active search, show search results
  if (searchQuery) {
    return (
      <div className={styles.container}>
        <SearchResults 
          results={searchResults}
          onTrackClick={(path): void => {
            void (async () => {
              await addTrackToQueue(path)
              hideKeyboard()
              
              // Find the track title for the toast
              const track = searchResults.find(result => result.path === path)
              if (track) {
                showToast(`Added "${track.title}" to queue`, 'success')
              }
            })()
          }}
          isLoading={isSearching}
        />
      </div>
    )
  }

  const sections: SectionConfig[] = [
    { id: 'admin', name: 'Admin', icon: Settings },
    { id: 'ui', name: 'User Interface', icon: Palette },
    { id: 'party', name: 'Party Mode', icon: PartyPopper },
    { id: 'statistics', name: 'Statistics', icon: BarChart3 }
  ]

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Settings</h1>
      
      <div className={styles.navigation}>
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={(): void => setActiveSection(section.id)}
            className={`${styles.navButton} ${activeSection === section.id ? styles.active : ''}`}
          >
            <span className={styles.navIcon}>
              <section.icon size={20} />
            </span>
            <span className={styles.navText}>{section.name}</span>
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {activeSection === 'admin' && <AdminSection />}
        {activeSection === 'ui' && <UserInterfaceSection />}
        {activeSection === 'party' && <PartyModeSection />}
        {activeSection === 'statistics' && <StatisticsSection />}
      </div>

      {/* If party mode is enabled and user is not authenticated, show PIN modal */}
      {settings.partyMode.enabled && !isAuthenticated && (
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
                onClick={(): void => { void handlePinSubmit(); }}
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

// Admin Section Component
function AdminSection(): JSX.Element {
  const { settings, updateSettings } = useSettings()
  const [jukeboxName, setJukeboxName] = useState(settings.jukeboxName)
  const [adminPin, setAdminPin] = useState(settings.adminPin ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const handleSaveSettings = async (): Promise<void> => {
    setIsSaving(true)
    setSaveMessage('')
    
    try {
      await updateSettings({
        jukeboxName: jukeboxName.trim() || 'Jukebox 2.0',
        adminPin: adminPin || '1234'
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

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Admin Settings</h2>
      
      <div className={styles.settingGroup}>
        <h3 className={styles.subsectionTitle}>Jukebox Configuration</h3>
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
        </div>
      </div>

      <div className={styles.settingGroup}>
        <h3 className={styles.subsectionTitle}>Security</h3>
        <div className={styles.setting}>
          <label htmlFor="adminPin" className={styles.label}>
            Admin PIN
          </label>
          <input
            id="adminPin"
            type="password"
            value={adminPin}
            onChange={(e) => setAdminPin(e.target.value)}
            className={styles.input}
            placeholder="Enter admin PIN (min 4 digits)"
            maxLength={10}
            pattern="[0-9]*"
          />
                     <p className={styles.description}>
             Set an admin PIN to protect settings access when party mode is enabled. Default PIN is &quot;1234&quot;.
           </p>
        </div>
      </div>

      <div className={styles.settingGroup}>
        <h3 className={styles.subsectionTitle}>Music Library</h3>
        <MusicScanSection />
      </div>

      <button
        onClick={() => { void handleSaveSettings(); }}
        disabled={isSaving}
        className={styles.saveButton}
      >
        {isSaving ? 'Saving...' : 'Save Admin Settings'}
      </button>
      
      {saveMessage && (
        <div className={`${styles.message} ${saveMessage.includes('success') ? styles.success : styles.error}`}>
          {saveMessage}
        </div>
      )}
    </div>
  )
}

// User Interface Section Component
function UserInterfaceSection(): JSX.Element {
  const { settings, updateSettings } = useSettings()
  const { themes, setTheme } = useThemeContext()
  const [selectedTheme, setSelectedTheme] = useState(settings.theme)
  

  const [showTouchKeyboard, setShowTouchKeyboard] = useState(settings.showTouchKeyboard)
  const [showPagination, setShowPagination] = useState(settings.showPagination)
  const [showConcertDetails, setShowConcertDetails] = useState(settings.showConcertDetails)
  const [showMobileQR, setShowMobileQR] = useState(settings.showMobileQR)
  const [useMobileAlbumLayout, setUseMobileAlbumLayout] = useState(settings.useMobileAlbumLayout)
  const [useSideBySideAlbumLayout, setUseSideBySideAlbumLayout] = useState(settings.useSideBySideAlbumLayout)
  const [showPlaybackPosition, setShowPlaybackPosition] = useState(settings.showPlaybackPosition)
  const [enableAdminMode, setEnableAdminMode] = useState(settings.enableAdminMode)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const handleSaveTheme = async (themeId?: string): Promise<void> => {
    const themeToSave = themeId ?? selectedTheme
    setIsSaving(true)
    setSaveMessage('')
    
    try {
      await updateSettings({ theme: themeToSave })
      setTheme(themeToSave)
      // Don't update selectedTheme here since it's already set in the onClick
      setSaveMessage('Theme saved successfully!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Error saving theme:', error)
      setSaveMessage('Failed to save theme')
      setTimeout(() => setSaveMessage(''), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveUiFeatures = async (): Promise<void> => {
    setIsSaving(true)
    setSaveMessage('')
    
    try {
      await updateSettings({
        showTouchKeyboard,
        showPagination,
        showConcertDetails,
        showMobileQR,
        useMobileAlbumLayout,
        useSideBySideAlbumLayout,
        showPlaybackPosition,
        enableAdminMode
      })
      setSaveMessage('UI features saved successfully!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Error saving UI features:', error)
      setSaveMessage('Failed to save UI features')
      setTimeout(() => setSaveMessage(''), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleLibraryLayoutChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    void updateSettings({ libraryLayout: e.target.value as 'modern' | 'classic' | 'large' });
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>User Interface Settings</h2>
      
      <div className={styles.settingGroup}>
        <h3 className={styles.subsectionTitle}>Theme</h3>
        <div className={styles.themeSelection}>
          <div className={styles.themeGrid}>
            {themes && themes.length > 0 ? themes.map((theme) => {
              // Skip themes with missing color data
              if (!theme.colors?.primary || !theme.colors?.secondary || !theme.colors?.accent) {
                return null
              }
              
              return (
                <button
                  key={theme.id}
                  type="button"
                  className={`${styles.themeCard} ${selectedTheme === theme.id ? styles.themeCardActive : ''}`}
                  onClick={() => {
                    setSelectedTheme(theme.id)
                    void handleSaveTheme(theme.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedTheme(theme.id)
                      void handleSaveTheme(theme.id)
                    }
                  }}
                >
                  <div className={styles.themePreview}>
                    <div 
                      className={styles.themeColors}
                      style={{
                        background: `linear-gradient(135deg, ${theme.colors.primary || '#1a1a2e'} 0%, ${theme.colors.secondary || '#16213e'} 100%)`
                      }}
                    >
                      <div 
                        className={styles.themeAccent}
                        style={{ backgroundColor: theme.colors.accent || '#ffd700' }}
                      />
                      <div 
                        className={styles.themeSurface}
                        style={{ backgroundColor: theme.colors.surface || 'rgba(255, 255, 255, 0.05)' }}
                      />
                    </div>
                  </div>
                  <div className={styles.themeInfo}>
                    <h4 className={styles.themeName}>{theme.name}</h4>
                    <p className={styles.themeDescription}>{theme.description}</p>
                  </div>
                  {selectedTheme === theme.id && (
                    <div className={styles.themeSelected}>
                      <div className={styles.selectedIndicator} />
                    </div>
                  )}
                </button>
              )
            }) : (
              <div className={styles.themeLoading}>
                <p>Loading themes...</p>
              </div>
            )}
          </div>
          {isSaving && (
            <div className={styles.themeSaving}>
              <p>Saving theme...</p>
            </div>
          )}
        </div>
      </div>

      <div className={styles.settingGroup}>
        <h3 className={styles.subsectionTitle}>UI Features</h3>
        <p className={styles.description}>
          Enable or disable various UI features for a better user experience.
        </p>
        
        <div className={styles.featuresGrid}>
          <div className={styles.featureSection}>
            <h4 className={styles.featureTitle}>Input</h4>
            <div className={styles.toggleSetting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={showTouchKeyboard}
                  onChange={() => setShowTouchKeyboard(!showTouchKeyboard)}
                  className={styles.toggle}
                />
                <span className={styles.toggleText}>Show Touch Keyboard</span>
              </label>
            </div>
          </div>

          <div className={styles.featureSection}>
            <h4 className={styles.featureTitle}>Navigation</h4>
            <div className={styles.toggleSetting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={showPagination}
                  onChange={() => setShowPagination(!showPagination)}
                  className={styles.toggle}
                />
                <span className={styles.toggleText}>Show Pagination</span>
              </label>
            </div>
          </div>

          <div className={styles.featureSection}>
            <h4 className={styles.featureTitle}>Information Display</h4>
            <div className={styles.toggleSetting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={showConcertDetails}
                  onChange={() => setShowConcertDetails(!showConcertDetails)}
                  className={styles.toggle}
                />
                <span className={styles.toggleText}>Show Concert Details</span>
              </label>
            </div>
          </div>

          <div className={styles.featureSection}>
            <h4 className={styles.featureTitle}>Mobile Access</h4>
            <div className={styles.toggleSetting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={showMobileQR}
                  onChange={() => setShowMobileQR(!showMobileQR)}
                  className={styles.toggle}
                />
                <span className={styles.toggleText}>Show Mobile QR Code</span>
              </label>
            </div>
          </div>

          <div className={styles.featureSection}>
            <h4 className={styles.featureTitle}>Layout</h4>
            <div className={styles.toggleSetting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={useMobileAlbumLayout}
                  onChange={() => setUseMobileAlbumLayout(!useMobileAlbumLayout)}
                  className={styles.toggle}
                />
                <span className={styles.toggleText}>Use Mobile Album Layout</span>
              </label>
            </div>
            <div className={styles.toggleSetting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={useSideBySideAlbumLayout}
                  onChange={() => setUseSideBySideAlbumLayout(!useSideBySideAlbumLayout)}
                  className={styles.toggle}
                />
                <span className={styles.toggleText}>Use Side-by-Side Album Layout</span>
              </label>
            </div>
            <div className={styles.setting}>
              <label htmlFor="libraryLayout" className={styles.label}>Library Layout Style</label>
              <select
                id="libraryLayout"
                value={settings.libraryLayout}
                onChange={handleLibraryLayoutChange}
                className={styles.select}
              >
                <option value="modern">Modern (Grid)</option>
                <option value="classic">Classic (4-up with tracks)</option>
                <option value="large">Large (2x6 with letters)</option>
              </select>
            </div>
          </div>

          <div className={styles.featureSection}>
            <h4 className={styles.featureTitle}>Playback Position</h4>
            <div className={styles.toggleSetting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={showPlaybackPosition}
                  onChange={() => setShowPlaybackPosition(!showPlaybackPosition)}
                  className={styles.toggle}
                />
                <span className={styles.toggleText}>Show Playback Position</span>
              </label>
            </div>
          </div>

          <div className={styles.featureSection}>
            <h4 className={styles.featureTitle}>Admin Features</h4>
            <div className={styles.toggleSetting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={enableAdminMode}
                  onChange={() => setEnableAdminMode(!enableAdminMode)}
                  className={styles.toggle}
                />
                <span className={styles.toggleText}>Enable Admin Mode</span>
              </label>
            </div>
            <p className={styles.description}>
              When enabled, admin features will be available for managing albums and files on disk.
            </p>
          </div>
        </div>
        
        <button
          onClick={() => { void handleSaveUiFeatures(); }}
          disabled={isSaving}
          className={styles.saveButton}
        >
          {isSaving ? 'Saving...' : 'Save UI Features'}
        </button>
      </div>
      
      {saveMessage && (
        <div className={`${styles.message} ${saveMessage.includes('success') ? styles.success : styles.error}`}>
          {saveMessage}
        </div>
      )}
    </div>
  )
}

// Party Mode Section Component
function PartyModeSection(): JSX.Element {
  const { settings, updateSettings } = useSettings()
  const [partyMode, setPartyMode] = useState(settings.partyMode)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const handleSavePartyMode = async (): Promise<void> => {
    setIsSaving(true)
    setSaveMessage('')
    
    try {
      await updateSettings({ partyMode })
      setSaveMessage('Party mode settings saved successfully!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Error saving party mode settings:', error)
      setSaveMessage('Failed to save party mode settings')
      setTimeout(() => setSaveMessage(''), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePartyModeToggle = (key: keyof typeof partyMode): void => {
    setPartyMode(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Party Mode Controls</h2>
      <p className={styles.description}>
        Enable party mode to restrict certain features and prevent unwanted changes during events.
      </p>
      
      <div className={styles.settingGroup}>
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

      <div className={styles.settingGroup}>
        <h3 className={styles.subsectionTitle}>Playback Controls</h3>
        <div className={styles.controlsGrid}>
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
      </div>

      <div className={styles.settingGroup}>
        <h3 className={styles.subsectionTitle}>Playlist Management</h3>
        <div className={styles.controlsGrid}>
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
      </div>

      <div className={styles.settingGroup}>
        <h3 className={styles.subsectionTitle}>Queue Management</h3>
        <div className={styles.controlsGrid}>
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
      
      {saveMessage && (
        <div className={`${styles.message} ${saveMessage.includes('success') ? styles.success : styles.error}`}>
          {saveMessage}
        </div>
      )}
    </div>
  )
}

// Statistics Section Component
function StatisticsSection(): JSX.Element {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Statistics</h2>
      
      <div className={styles.settingGroup}>
        <h3 className={styles.subsectionTitle}>Play Statistics</h3>
        <PlayCounts />
      </div>

      <div className={styles.settingGroup}>
        <h3 className={styles.subsectionTitle}>System Logs</h3>
        <LogsViewer />
      </div>
    </div>
  )
}

// Music Scan Section Component
function MusicScanSection(): JSX.Element {
  const [isScanning, setIsScanning] = useState(false)
  const [currentPaths, setCurrentPaths] = useState<string[]>([])
  const [scanResults, setScanResults] = useState<{ [path: string]: { albums: number; files: number; lastScanned: string } }>({})
  const [scanProgress, setScanProgress] = useState({
    isVisible: false,
    currentFile: '',
    scannedFiles: 0,
    totalFiles: 0,
    currentAlbum: ''
  })

  // Load current paths on component mount
  useEffect(() => {
    void loadCurrentPaths()
  }, [])

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
        setCurrentPaths(directories) // Update current paths with the scanned directories
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

  return (
    <div>
      <p className={styles.description}>
        Configure music library scanning to discover and index your music files.
      </p>
      <MusicFoldersManager 
        onScan={(directories) => { void handleScan(directories); }}
        isScanning={isScanning}
        currentPaths={currentPaths}
        scanResults={scanResults}
      />
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