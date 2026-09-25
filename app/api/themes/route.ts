import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import bundledThemes from '@/config/themes.json'

// Must run per request: a GET handler that doesn't read the request is otherwise
// evaluated once at build time and served frozen in production.
export const dynamic = 'force-dynamic'

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

// Built-in theme catalog. Shipped with the app so fresh clones and Docker
// containers get every theme; data/themes.json is only an optional local override.
const BUILT_IN_THEMES = (bundledThemes as ThemesData).themes

// Themes in data/themes.json replace a built-in theme with the same id, or are
// appended as extra themes.
function loadThemes(): Theme[] {
  const overridePath = path.join(process.cwd(), 'data', 'themes.json')
  if (!fs.existsSync(overridePath)) return BUILT_IN_THEMES

  const overrides = (JSON.parse(fs.readFileSync(overridePath, 'utf-8')) as ThemesData).themes ?? []
  const byId = new Map(overrides.map(theme => [theme.id, theme]))
  const merged = BUILT_IN_THEMES.map(theme => byId.get(theme.id) ?? theme)
  const builtInIds = new Set(BUILT_IN_THEMES.map(theme => theme.id))
  return [...merged, ...overrides.filter(theme => !builtInIds.has(theme.id))]
}

export function GET(): Promise<NextResponse> {
  try {
    return Promise.resolve(NextResponse.json({ themes: loadThemes() }))
  } catch (error) {
    console.error('Error loading themes:', error)
    // A broken override file shouldn't take the themes away.
    return Promise.resolve(NextResponse.json({ themes: BUILT_IN_THEMES }))
  }
}
