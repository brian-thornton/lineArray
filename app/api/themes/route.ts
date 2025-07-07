import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface Theme {
  id: string
  name: string
  description: string
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    surface: string
    text: string
    textSecondary: string
    textTertiary: string
    border: string
    shadow: string
    success: string
    error: string
    warning: string
  }
}

interface ThemesData {
  themes: Theme[]
}

export function GET(): Promise<NextResponse> {
  try {
    const themesPath = path.join(process.cwd(), 'data', 'themes.json')
    
    if (fs.existsSync(themesPath)) {
      const data = fs.readFileSync(themesPath, 'utf-8')
      const themes = JSON.parse(data) as ThemesData
      return Promise.resolve(NextResponse.json(themes))
    } else {
      // Return default theme if themes.json doesn't exist
      const defaultThemes: ThemesData = {
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
      return Promise.resolve(NextResponse.json(defaultThemes))
    }
  } catch (error) {
    console.error('Error loading themes:', error)
    return Promise.resolve(NextResponse.json(
      { error: 'Failed to load themes' },
      { status: 500 }
    ))
  }
} 