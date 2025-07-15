'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Settings } from '@/types/music'

interface SettingsContextType {
  settings: Settings
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>
  refreshSettings: () => Promise<void>
  isPartyModeEnabled: () => boolean
  canPerformAction: (action: keyof Settings['partyMode']) => boolean
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }): JSX.Element {
  const [settings, setSettings] = useState<Settings>({
    scanPath: '',
    jukeboxName: 'Jukebox 2.0',
    adminPin: '1234',
    theme: 'jukebox-classic',
    showTouchKeyboard: true,
    showPagination: true,
    showConcertDetails: true,
    showMobileQR: true,
    useMobileAlbumLayout: false,
    showPlaybackPosition: true,
    libraryLayout: 'modern',
    partyMode: {
      enabled: false,
      allowPlay: true,
      allowStop: true,
      allowNext: true,
      allowPrevious: true,
      allowCreatePlaylists: true,
      allowEditPlaylists: true,
      allowDeletePlaylists: true,
      allowAddToQueue: true,
      allowRemoveFromQueue: true,
      allowSkipInQueue: true
    }
  })

  const loadSettings = async (): Promise<void> => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json() as Settings
        // console.log('Loaded settings:', data)
        setSettings(data)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const updateSettings = async (newSettings: Partial<Settings>) => {
    try {
      // console.log('Updating settings with:', newSettings)
      // console.log('Current settings before update:', settings)
      
      // Create a properly merged settings object
      const mergedSettings = {
        ...settings,
        ...newSettings,
        // Ensure partyMode is properly merged if it exists in newSettings
        ...(newSettings.partyMode && {
          partyMode: {
            ...settings.partyMode,
            ...newSettings.partyMode
          }
        })
      }
      
      // console.log('Merged settings to send:', mergedSettings)
      
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mergedSettings),
      })
      
      if (response.ok) {
        const updatedSettings = await response.json() as Settings
        // console.log('Settings updated successfully:', updatedSettings)
        setSettings(updatedSettings)
      } else {
        console.error('Failed to update settings:', response.status, response.statusText)
        const errorText = await response.text()
        console.error('Error response:', errorText)
        throw new Error(`Failed to update settings: ${response.status}`)
      }
    } catch (error) {
      console.error('Error updating settings:', error)
      throw error
    }
  }

  const refreshSettings = async (): Promise<void> => {
    await loadSettings()
  }

  const isPartyModeEnabled = (): boolean => {
    return settings.partyMode.enabled
  }

  const canPerformAction = (action: keyof Settings['partyMode']): boolean => {
    // If party mode is disabled, all actions are allowed
    if (!settings.partyMode.enabled) {
      return true
    }
    
    // Check if the specific action is allowed
    return settings.partyMode[action]
  }

  useEffect(() => {
    void loadSettings()
  }, [])

  return (
    <SettingsContext.Provider value={{ 
      settings, 
      updateSettings, 
      refreshSettings, 
      isPartyModeEnabled, 
      canPerformAction 
    }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
} 