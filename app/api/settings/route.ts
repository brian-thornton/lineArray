import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface Settings {
  scanPath: string
  jukeboxName: string
  adminPin?: string
  theme: string
  partyMode: {
    enabled: boolean
    allowPlay: boolean
    allowStop: boolean
    allowNext: boolean
    allowPrevious: boolean
    allowCreatePlaylists: boolean
    allowEditPlaylists: boolean
    allowDeletePlaylists: boolean
    allowAddToQueue: boolean
    allowRemoveFromQueue: boolean
    allowSkipInQueue: boolean
  }
}

const settingsPath = path.join(process.cwd(), 'data', 'settings.json')

function loadSettings(): Settings {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8')
      const existingSettings = JSON.parse(data)
      console.log('Loaded existing settings from file:', existingSettings)
      
      // Merge with defaults, ensuring partyMode is properly handled
      const settings = {
        scanPath: existingSettings.scanPath || '/Users/brianthornton/Desktop/Music/Dave Matthews',
        jukeboxName: existingSettings.jukeboxName || 'Jukebox 2.0',
        adminPin: existingSettings.adminPin,
        theme: existingSettings.theme || 'jukebox-classic',
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
          allowSkipInQueue: true,
          ...existingSettings.partyMode // Merge any existing party mode settings
        }
      }
      
      console.log('Merged settings:', settings)
      return settings
    }
  } catch (error) {
    console.error('Error loading settings:', error)
  }
  
  // Default settings
  const defaultSettings = {
    scanPath: '/Users/brianthornton/Desktop/Music/Dave Matthews',
    jukeboxName: 'Jukebox 2.0',
    theme: 'jukebox-classic',
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
  }
  
  console.log('Using default settings:', defaultSettings)
  return defaultSettings
}

function saveSettings(settings: Settings): void {
  try {
    console.log('saveSettings called with:', settings)
    console.log('Settings path:', settingsPath)
    
    // Ensure the data directory exists
    const dataDir = path.dirname(settingsPath)
    console.log('Data directory:', dataDir)
    
    if (!fs.existsSync(dataDir)) {
      console.log('Creating data directory...')
      fs.mkdirSync(dataDir, { recursive: true })
    }
    
    const settingsJson = JSON.stringify(settings, null, 2)
    console.log('Writing settings JSON:', settingsJson)
    
    fs.writeFileSync(settingsPath, settingsJson)
    console.log('Settings file written successfully')
    
    // Verify the file was written
    if (fs.existsSync(settingsPath)) {
      const writtenData = fs.readFileSync(settingsPath, 'utf-8')
      console.log('Verified written data:', writtenData)
    } else {
      console.error('Settings file does not exist after writing!')
    }
  } catch (error) {
    console.error('Error saving settings:', error)
    throw error
  }
}

export async function GET() {
  try {
    const settings = loadSettings()
    console.log('GET settings:', settings)
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('PUT settings request body:', body)
    const currentSettings = loadSettings()
    console.log('Current settings:', currentSettings)
    
    const updatedSettings: Settings = {
      ...currentSettings,
      ...body
    }
    console.log('Updated settings to save:', updatedSettings)
    
    saveSettings(updatedSettings)
    
    return NextResponse.json(updatedSettings)
  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
} 