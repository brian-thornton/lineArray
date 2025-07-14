import { NextRequest, NextResponse } from 'next/server'

interface Theme {
  id: string;
  name: string;
}

interface ThemesResponse {
  themes: Theme[];
}

interface SettingsResponse {
  theme?: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Build absolute URL base
  const base = req.nextUrl.origin;

  // Get all themes
  let themes: Theme[] = [];
  let themesError: string | null = null;
  try {
    const resp = await fetch(`${base}/api/themes`);
    if (resp.ok) {
      const json: unknown = await resp.json();
      const { themes: fetchedThemes } = json as ThemesResponse;
      themes = fetchedThemes;
    } else {
      themesError = `Status ${resp.status}`;
    }
  } catch (e) {
    const error = e as Error;
    themesError = error?.message ?? 'Unknown error';
  }

  // Get backend settings
  let backendTheme: string | null = null;
  let settingsError: string | null = null;
  try {
    const resp = await fetch(`${base}/api/settings`);
    if (resp.ok) {
      const json: unknown = await resp.json();
      const { theme } = json as SettingsResponse;
      backendTheme = theme ?? null;
    } else {
      settingsError = `Status ${resp.status}`;
    }
  } catch (e) {
    const error = e as Error;
    settingsError = error?.message ?? 'Unknown error';
  }

  // We cannot access localStorage from the server, so just note that
  const localStorageTheme = null;

  // Figure out which theme would be applied
  let appliedTheme: Theme | null = null;
  if (themes.length > 0) {
    // Try backend theme first
    if (backendTheme) {
      appliedTheme = themes.find(t => t.id === backendTheme) ?? null;
    }
    // Fallback to first theme
    if (!appliedTheme) {
      [appliedTheme] = themes;
    }
  }

  return NextResponse.json({
    themes: themes.map(t => ({ id: t.id, name: t.name })),
    themesError,
    backendTheme,
    settingsError,
    localStorageTheme,
    appliedTheme: appliedTheme ? { id: appliedTheme.id, name: appliedTheme.name } : null
  });
} 