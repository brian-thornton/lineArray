import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface Settings {
  scanPath: string
  jukeboxName: string
}

const settingsPath = path.join(process.cwd(), 'data', 'settings.json')

function loadSettings(): Settings {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8')
      const settings = JSON.parse(data)
      return {
        scanPath: settings.scanPath || '/Users/brianthornton/Desktop/Music/Dave Matthews',
        jukeboxName: settings.jukeboxName || 'Jukebox 2.0'
      }
    }
  } catch (error) {
    console.error('Error loading settings:', error)
  }
  
  // Default settings
  return {
    scanPath: '/Users/brianthornton/Desktop/Music/Dave Matthews',
    jukeboxName: 'Jukebox 2.0'
  }
}

function saveSettings(settings: Settings): void {
  try {
    // Ensure the data directory exists
    const dataDir = path.dirname(settingsPath)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  } catch (error) {
    console.error('Error saving settings:', error)
    throw error
  }
}

export async function GET() {
  try {
    const settings = loadSettings()
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
    const currentSettings = loadSettings()
    
    const updatedSettings: Settings = {
      ...currentSettings,
      ...body
    }
    
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