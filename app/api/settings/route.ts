import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import logger from '@/utils/serverLogger'

interface Settings {
  scanPath: string
  jukeboxName: string
  adminPin?: string
  theme: string
  showTouchKeyboard: boolean
  showPagination: boolean
  showConcertDetails: boolean
  showMobileQR: boolean
  useMobileAlbumLayout: boolean
  useSideBySideAlbumLayout: boolean
  showPlaybackPosition: boolean
  enableAdminMode: boolean
  libraryLayout: 'modern' | 'classic' | 'large'
  audioPlayer: 'vlc' | 'mpv' | 'ffplay'
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
      const existingSettings = JSON.parse(data) as Partial<Settings>
      logger.info('Loaded existing settings from file', 'SettingsAPI', existingSettings)
      
      // Merge with defaults, ensuring partyMode is properly handled
      const settings: Settings = {
        scanPath: existingSettings.scanPath ?? '',
        jukeboxName: existingSettings.jukeboxName ?? 'Jukebox 2.0',
        adminPin: existingSettings.adminPin,
        theme: existingSettings.theme ?? 'jukebox-classic',
        showTouchKeyboard: existingSettings.showTouchKeyboard ?? true,
        showPagination: existingSettings.showPagination ?? true,
        showConcertDetails: existingSettings.showConcertDetails ?? true,
        showMobileQR: existingSettings.showMobileQR ?? true,
        useMobileAlbumLayout: existingSettings.useMobileAlbumLayout ?? false,
        useSideBySideAlbumLayout: existingSettings.useSideBySideAlbumLayout ?? false,
        showPlaybackPosition: existingSettings.showPlaybackPosition ?? true,
        enableAdminMode: existingSettings.enableAdminMode ?? false,
        libraryLayout: existingSettings.libraryLayout ?? 'modern',
        audioPlayer: existingSettings.audioPlayer ?? 'vlc',
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
      
      logger.info('Merged settings', 'SettingsAPI', settings)
      return settings
    }
  } catch (error) {
    logger.error('Error loading settings', 'SettingsAPI', error)
  }
  
  // Default settings
  const defaultSettings: Settings = {
    scanPath: '',
    jukeboxName: 'Jukebox 2.0',
    theme: 'jukebox-classic',
    showTouchKeyboard: true,
    showPagination: true,
    showConcertDetails: true,
    showMobileQR: true,
    useMobileAlbumLayout: false,
    useSideBySideAlbumLayout: false,
    showPlaybackPosition: true,
    enableAdminMode: false,
    libraryLayout: 'modern',
    audioPlayer: 'vlc',
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
  
  logger.info('Using default settings', 'SettingsAPI', defaultSettings)
  return defaultSettings
}

function saveSettings(settings: Settings): void {
  try {
    logger.info('saveSettings called with', 'SettingsAPI', settings)
    logger.info('Settings path', 'SettingsAPI', settingsPath)
    
    // Ensure the data directory exists
    const dataDir = path.dirname(settingsPath)
    logger.info('Data directory', 'SettingsAPI', dataDir)
    
    if (!fs.existsSync(dataDir)) {
      logger.info('Creating data directory', 'SettingsAPI')
      fs.mkdirSync(dataDir, { recursive: true })
    }
    
    const settingsJson = JSON.stringify(settings, null, 2)
    logger.info('Writing settings JSON', 'SettingsAPI', settingsJson)
    
    fs.writeFileSync(settingsPath, settingsJson)
    logger.info('Settings file written successfully', 'SettingsAPI')
    
    // Verify the file was written
    if (fs.existsSync(settingsPath)) {
      const writtenData = fs.readFileSync(settingsPath, 'utf-8')
      logger.info('Verified written data', 'SettingsAPI', writtenData)
    } else {
      logger.error('Settings file does not exist after writing', 'SettingsAPI')
    }
  } catch (error) {
    logger.error('Error saving settings', 'SettingsAPI', error)
    throw error
  }
}

export function GET(): Promise<NextResponse> {
  try {
    const settingsPath = path.join(process.cwd(), 'data', 'settings.json')
    
    if (!fs.existsSync(settingsPath)) {
      // Return default settings if no settings file exists
          return Promise.resolve(NextResponse.json({
      scanPath: '',
      jukeboxName: 'Jukebox 2.0',
      adminPin: '1234',
      theme: 'jukebox-classic',
      showTouchKeyboard: true,
      showPagination: true,
      showConcertDetails: true,
      showMobileQR: true,
      useMobileAlbumLayout: false,
      useSideBySideAlbumLayout: false,
      showPlaybackPosition: true,
      enableAdminMode: false,
      libraryLayout: 'modern',
      audioPlayer: 'vlc',
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
    }))
    }

    const data = fs.readFileSync(settingsPath, 'utf8')
    const existingSettings = JSON.parse(data) as Partial<Settings>
    
    return Promise.resolve(NextResponse.json({
      scanPath: existingSettings.scanPath ?? '',
      jukeboxName: existingSettings.jukeboxName ?? 'Jukebox 2.0',
      adminPin: existingSettings.adminPin ?? '1234',
      theme: existingSettings.theme ?? 'jukebox-classic',
      showTouchKeyboard: existingSettings.showTouchKeyboard ?? true,
      showPagination: existingSettings.showPagination ?? true,
      showConcertDetails: existingSettings.showConcertDetails ?? true,
      showMobileQR: existingSettings.showMobileQR ?? true,
      useMobileAlbumLayout: existingSettings.useMobileAlbumLayout ?? false,
      useSideBySideAlbumLayout: existingSettings.useSideBySideAlbumLayout ?? false,
      showPlaybackPosition: existingSettings.showPlaybackPosition ?? true,
      enableAdminMode: existingSettings.enableAdminMode ?? false,
      libraryLayout: existingSettings.libraryLayout ?? 'modern',
      audioPlayer: existingSettings.audioPlayer ?? 'vlc',
      partyMode: {
        enabled: existingSettings.partyMode?.enabled ?? false,
        allowPlay: existingSettings.partyMode?.allowPlay ?? true,
        allowStop: existingSettings.partyMode?.allowStop ?? true,
        allowNext: existingSettings.partyMode?.allowNext ?? true,
        allowPrevious: existingSettings.partyMode?.allowPrevious ?? true,
        allowCreatePlaylists: existingSettings.partyMode?.allowCreatePlaylists ?? true,
        allowEditPlaylists: existingSettings.partyMode?.allowEditPlaylists ?? true,
        allowDeletePlaylists: existingSettings.partyMode?.allowDeletePlaylists ?? true,
        allowAddToQueue: existingSettings.partyMode?.allowAddToQueue ?? true,
        allowRemoveFromQueue: existingSettings.partyMode?.allowRemoveFromQueue ?? true,
        allowSkipInQueue: existingSettings.partyMode?.allowSkipInQueue ?? true
      }
    }))

  } catch (error) {
    logger.error('Error loading settings', 'SettingsAPI', error)
    return Promise.resolve(NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 }
    ))
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as Partial<Settings>
    logger.info('PUT settings request body', 'SettingsAPI', body)
    const currentSettings = loadSettings()
    logger.info('Current settings', 'SettingsAPI', currentSettings)
    
    const updatedSettings: Settings = {
      ...currentSettings,
      ...body
    }
    logger.info('Updated settings to save', 'SettingsAPI', updatedSettings)
    
    saveSettings(updatedSettings)
    
    return NextResponse.json(updatedSettings)
  } catch (error) {
    logger.error('Settings PUT error', 'SettingsAPI', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
} 

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as Partial<Settings>
    
    // Load existing settings
    const existingSettings = loadSettings()
    
    // Merge with new settings
    const updatedSettings: Settings = {
      ...existingSettings,
      ...body,
      // Ensure partyMode is properly merged
      partyMode: {
        ...existingSettings.partyMode,
        ...body.partyMode
      }
    }
    
    // Save to file
    const settingsPath = path.join(process.cwd(), 'data', 'settings.json')
    const dataDir = path.dirname(settingsPath)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    
    fs.writeFileSync(settingsPath, JSON.stringify(updatedSettings, null, 2))
    
    logger.info('Settings saved successfully', 'SettingsAPI', updatedSettings)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Settings saved successfully',
      settings: updatedSettings
    })
    
  } catch (error) {
    logger.error('Error saving settings', 'SettingsAPI', error)
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    )
  }
} 