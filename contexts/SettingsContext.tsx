'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface Settings {
  scanPath: string
  jukeboxName: string
}

interface SettingsContextType {
  settings: Settings
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>
  refreshSettings: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>({
    scanPath: '/Users/brianthornton/Desktop/Music/Dave Matthews',
    jukeboxName: 'Jukebox 2.0'
  })

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const updateSettings = async (newSettings: Partial<Settings>) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          ...newSettings
        }),
      })
      
      if (response.ok) {
        const updatedSettings = await response.json()
        setSettings(updatedSettings)
      }
    } catch (error) {
      console.error('Error updating settings:', error)
      throw error
    }
  }

  const refreshSettings = async () => {
    await loadSettings()
  }

  useEffect(() => {
    loadSettings()
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
} 