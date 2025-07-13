'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Theme } from '@/types/music'

interface ThemeContextType {
  currentTheme: Theme
  themes: Theme[]
  setTheme: (themeId: string) => void
  applyTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// Default theme (jukebox-classic)
const defaultTheme: Theme = {
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

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [themes, setThemes] = useState<Theme[]>([defaultTheme])
  const [currentTheme, setCurrentTheme] = useState<Theme>(defaultTheme)

  // Load themes from the themes.json file
  const loadThemes = async (): Promise<void> => {
    try {
      const response = await fetch('/api/themes')
      if (response.ok) {
        const data = await response.json() as { themes: Theme[] }
        setThemes(data.themes || [defaultTheme])
      }
    } catch (error) {
      console.error('Error loading themes:', error)
    }
  }

  // Apply theme to CSS custom properties
  const applyTheme = (theme: Theme): void => {
    const root = document.documentElement
    const body = document.body
    
    // Set CSS custom properties for the theme
    root.style.setProperty('--jukebox-primary', theme.colors.primary)
    root.style.setProperty('--jukebox-secondary', theme.colors.secondary)
    root.style.setProperty('--jukebox-accent', theme.colors.accent)
    root.style.setProperty('--jukebox-background', theme.colors.background)
    root.style.setProperty('--jukebox-surface', theme.colors.surface)
    root.style.setProperty('--jukebox-text', theme.colors.text)
    root.style.setProperty('--jukebox-text-secondary', theme.colors.textSecondary)
    root.style.setProperty('--jukebox-text-tertiary', theme.colors.textTertiary)
    root.style.setProperty('--jukebox-border', theme.colors.border)
    root.style.setProperty('--jukebox-shadow', theme.colors.shadow)
    root.style.setProperty('--jukebox-success', theme.colors.success)
    root.style.setProperty('--jukebox-error', theme.colors.error)
    root.style.setProperty('--jukebox-warning', theme.colors.warning)
    

    
    // Apply theme directly to body and html for immediate effect
    if (body) {
      body.style.backgroundColor = theme.colors.background
      body.style.color = theme.colors.text
    }
    root.style.backgroundColor = theme.colors.background
    root.style.color = theme.colors.text
    
    // Update legacy CSS variables for backward compatibility
    // For gradients, use the first color as fallback
    const getFirstColor = (colorValue: string) => {
      if (colorValue.startsWith('linear-gradient')) {
        // Extract first color from gradient
        const match = colorValue.match(/#[0-9a-fA-F]{6}/)
        return match ? match[0] : '#1a1a2e'
      }
      return colorValue
    }
    
    root.style.setProperty('--jukebox-dark', getFirstColor(theme.colors.primary))
    root.style.setProperty('--jukebox-darker', getFirstColor(theme.colors.background))
    root.style.setProperty('--jukebox-accent', theme.colors.accent)
    root.style.setProperty('--jukebox-accent-dark', getFirstColor(theme.colors.secondary))
    root.style.setProperty('--jukebox-white', theme.colors.text)
    root.style.setProperty('--jukebox-gray', theme.colors.textSecondary)
    root.style.setProperty('--jukebox-purple', getFirstColor(theme.colors.secondary))
    root.style.setProperty('--jukebox-gold', theme.colors.accent)
    root.style.setProperty('--jukebox-blue', theme.colors.accent)
    

    
    // Enhanced mobile Safari support
    if (typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
      // Apply theme directly to body and html for mobile Safari
      if (body) {
        body.style.backgroundColor = theme.colors.background
        body.style.color = theme.colors.text
        body.style.setProperty('--jukebox-background', theme.colors.background)
        body.style.setProperty('--jukebox-text', theme.colors.text)
        body.style.setProperty('--jukebox-accent', theme.colors.accent)
      }
      
      // Force multiple reflows to ensure theme is applied
      root.offsetHeight
      body?.offsetHeight
      
      // Apply theme to html element as well
      root.style.backgroundColor = theme.colors.background
      root.style.color = theme.colors.text
      
      // Re-apply theme with delays to ensure it sticks on mobile Safari
      const reapplyTheme = () => {
        root.style.setProperty('--jukebox-background', theme.colors.background)
        root.style.setProperty('--jukebox-text', theme.colors.text)
        root.style.setProperty('--jukebox-accent', theme.colors.accent)
        
        if (body) {
          body.style.backgroundColor = theme.colors.background
          body.style.color = theme.colors.text
          body.style.setProperty('--jukebox-background', theme.colors.background)
          body.style.setProperty('--jukebox-text', theme.colors.text)
        }
        
        root.style.backgroundColor = theme.colors.background
        root.style.color = theme.colors.text
        
        // Force reflow
        root.offsetHeight
        body?.offsetHeight
      }
      
      // Apply multiple times with delays
      setTimeout(reapplyTheme, 50)
      setTimeout(reapplyTheme, 150)
      setTimeout(reapplyTheme, 300)
      setTimeout(reapplyTheme, 500)
      
      // Add a class to body for additional CSS targeting
      body?.classList.add('theme-applied')

      // Add/update meta theme-color for Safari
      let metaThemeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
      if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta');
        metaThemeColor.name = 'theme-color';
        document.head.appendChild(metaThemeColor);
      }
      metaThemeColor.content = theme.colors.background;
    }
    

  }

  // Set theme by ID
  const setTheme = (themeId: string): void => {
    const theme = themes.find(t => t.id === themeId)
    if (theme) {
      setCurrentTheme(theme)
      applyTheme(theme)
      
      // Save theme preference to localStorage
      localStorage.setItem('jukebox-theme', themeId)
    }
  }

  // Load themes and then apply the correct theme
  useEffect(() => {
    let didCancel = false;
    const loadAndApplyTheme = async () => {
      await loadThemes().catch(console.error);
      if (didCancel) return;
      
      const savedTheme = localStorage.getItem('jukebox-theme');
      
      if (savedTheme && themes.find(t => t.id === savedTheme)) {
        setTheme(savedTheme);
      } else {
        // Try to load theme from backend settings
        try {
          const res = await fetch('/api/settings');
          if (res.ok) {
            const data = await res.json() as { theme?: string };
            if (data?.theme && themes.find(t => t.id === data.theme)) {
              setTheme(data.theme);
              return;
            }
          }
        } catch (error) {
          console.error('Error loading theme from settings:', error)
        }
        // Fallback to default
        setTheme(defaultTheme.id);
      }
    };
    loadAndApplyTheme();
    return () => { didCancel = true; };
  }, [themes.length]);

  // Apply theme when currentTheme changes
  useEffect(() => {
    applyTheme(currentTheme)
    
    // Reapply theme after a short delay to ensure it sticks
    const timer = setTimeout(() => {
      applyTheme(currentTheme)
    }, 100)
    
    return () => clearTimeout(timer)
  }, [currentTheme])

  return (
    <ThemeContext.Provider value={{ 
      currentTheme, 
      themes, 
      setTheme, 
      applyTheme 
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
} 