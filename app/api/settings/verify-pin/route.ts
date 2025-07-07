import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface Settings {
  adminPin?: string
  partyMode: {
    enabled: boolean
  }
}

function loadSettings(): Settings {
  try {
    const settingsPath = path.join(process.cwd(), 'data', 'settings.json')
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8')
      return JSON.parse(data) as Settings
    }
  } catch (error) {
    console.error('Error loading settings:', error)
  }
  return { partyMode: { enabled: false } }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { pin } = await request.json() as { pin: string }
    
    if (!pin) {
      return NextResponse.json({ error: 'PIN is required' }, { status: 400 })
    }

    const settings = loadSettings()
    
    // Check if party mode is enabled
    if (!settings.partyMode?.enabled) {
      return NextResponse.json({ error: 'Party mode is not enabled' }, { status: 400 })
    }

    // Default PIN is "1234" if not set in settings
    const adminPin = settings.adminPin ?? '1234'
    
    if (pin === adminPin) {
      return NextResponse.json({ success: true, message: 'PIN verified successfully' })
    } else {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
    }
  } catch (error) {
    console.error('Error verifying PIN:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 