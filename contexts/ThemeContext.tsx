'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Theme } from '@/types/music'
import { THEME_VAR_MAP, THEME_COLORS_STORAGE_KEY, DEFAULT_THEME_ID, onAccentColor } from '@/utils/themeVars'

interface ThemeContextType {
  currentTheme: Theme
  themes: Theme[]
  setTheme: (themeId: string) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const defaultTheme: Theme = {
  id: DEFAULT_THEME_ID,
  name: "Slate Blue",
  description: "Cool slate grays with a clear blue accent",
  colors: {
    primary: "#1e293b",
    secondary: "#334155",
    accent: "#38a9f5",
    background: "#0f172a",
    surface: "rgba(148, 163, 184, 0.08)",
    text: "#f1f5f9",
    textSecondary: "#94a3b8",
    textTertiary: "#64748b",
    border: "rgba(148, 163, 184, 0.18)",
    shadow: "0 4px 20px rgba(0, 0, 0, 0.35)",
    success: "#34d399",
    error: "#f87171",
    warning: "#fbbf24",
  },
};

function applyThemeVars(theme: Theme) {
  const root = document.documentElement;
  const body = document.body;
  const c = theme.colors;
  for (const [cssVar, key] of THEME_VAR_MAP) {
    root.style.setProperty(cssVar, c[key]);
  }
  root.style.setProperty('--jukebox-on-accent', onAccentColor(c.accent));
  // Set body/bg color
  if (body) {
    body.style.backgroundColor = c.background;
    body.style.color = c.text;
  }
  root.style.backgroundColor = c.background;
  root.style.color = c.text;
  // Set meta theme-color
  let metaThemeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!metaThemeColor) {
    metaThemeColor = document.createElement('meta');
    metaThemeColor.name = 'theme-color';
    document.head.appendChild(metaThemeColor);
  }
  metaThemeColor.content = c.background;
  try {
    localStorage.setItem(THEME_COLORS_STORAGE_KEY, JSON.stringify(c));
  } catch {
    // Storage unavailable; the next full page load just starts from the default.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [themes, setThemes] = useState<Theme[]>([defaultTheme]);
  const [themesLoaded, setThemesLoaded] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<Theme>(defaultTheme);

  // Load themes from backend
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/themes");
        if (resp.ok) {
          const data = (await resp.json()) as { themes: Theme[] };
          if (!cancelled && data.themes && data.themes.length > 0) {
            setThemes(data.themes);
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[Theme] Failed to load themes", e);
      }
      if (!cancelled) setThemesLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Load selected theme from localStorage or backend, fallback to default.
  // Waits for the theme list: resolving against the built-in default alone would
  // briefly apply the default theme before the saved one.
  useEffect(() => {
    if (!themesLoaded) return;
    let cancelled = false;
    (async () => {
      let themeId = localStorage.getItem("jukebox-theme");
      let found: Theme | undefined;
      
      // Try backend settings FIRST (prioritize backend over localStorage)
      try {
        const resp = await fetch("/api/settings");
        if (resp.ok) {
          const data = (await resp.json()) as { theme?: string };
          if (data.theme) {
            found = themes.find((t) => t.id === data.theme);
            themeId = data.theme;
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[Theme] Failed to load theme from settings", e);
      }
      
      // Only check localStorage if backend didn't provide a theme
      if (!found && themeId && themes.length > 0) {
        found = themes.find((t) => t.id === themeId);
      }
      
      if (!found) {
        found = themes.find((t) => t.id === defaultTheme.id) || defaultTheme;
        themeId = found.id;
      }
      if (!cancelled && found) {
        setCurrentTheme(found);
        applyThemeVars(found);
        localStorage.setItem("jukebox-theme", themeId!);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themesLoaded, themes]);

  // Set theme by ID
  const setTheme = (themeId: string) => {
    const found = themes.find((t) => t.id === themeId);
    if (found) {
      setCurrentTheme(found);
      applyThemeVars(found);
      localStorage.setItem("jukebox-theme", themeId);
    }
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, themes, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useThemeContext must be used within a ThemeProvider");
  }
  return context;
} 