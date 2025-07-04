import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const themesPath = path.join(process.cwd(), 'data', 'themes.json')
    
    if (fs.existsSync(themesPath)) {
      const data = fs.readFileSync(themesPath, 'utf-8')
      const themes = JSON.parse(data)
      return NextResponse.json(themes)
    } else {
      // Return default theme if themes.json doesn't exist
      const defaultThemes = {
        themes: [
          {
            id: 'jukebox-classic',
            name: 'Jukebox Classic',
            description: 'The original jukebox theme with gold accents and dark blues',
            colors: {
              primary: '#1a1a2e',
              secondary: '#16213e',
              accent: '#ffd700',
              background: '#0f0f23',
              surface: 'rgba(255, 255, 255, 0.05)',
              text: '#ffffff',
              textSecondary: '#a0a0a0',
              textTertiary: '#666666',
              border: 'rgba(255, 255, 255, 0.1)',
              shadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              success: '#4ade80',
              error: '#f87171',
              warning: '#fbbf24'
            }
          }
        ]
      }
      return NextResponse.json(defaultThemes)
    }
  } catch (error) {
    console.error('Error loading themes:', error)
    return NextResponse.json(
      { error: 'Failed to load themes' },
      { status: 500 }
    )
  }
} 