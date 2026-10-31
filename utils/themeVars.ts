import { Theme } from '@/types/music'

type ThemeColorKey = keyof Theme['colors']

// CSS custom property -> theme color it takes its value from.
export const THEME_VAR_MAP: Array<[string, ThemeColorKey]> = [
  ['--jukebox-primary', 'primary'],
  ['--jukebox-secondary', 'secondary'],
  ['--jukebox-accent', 'accent'],
  ['--jukebox-background', 'background'],
  ['--jukebox-surface', 'surface'],
  ['--jukebox-text', 'text'],
  ['--jukebox-text-secondary', 'textSecondary'],
  ['--jukebox-text-tertiary', 'textTertiary'],
  ['--jukebox-border', 'border'],
  ['--jukebox-shadow', 'shadow'],
  ['--jukebox-success', 'success'],
  ['--jukebox-error', 'error'],
  ['--jukebox-warning', 'warning'],
  // Legacy/fallback vars
  ['--jukebox-dark', 'primary'],
  ['--jukebox-darker', 'background'],
  ['--jukebox-white', 'text'],
  ['--jukebox-gray', 'textSecondary'],
  ['--jukebox-purple', 'secondary'],
  ['--jukebox-gold', 'accent'],
  ['--jukebox-blue', 'accent'],
]

export const DEFAULT_THEME_ID = 'slate-blue'

// Text/icon colour for things drawn on the accent colour (gold, blue, ...): dark on light
// accents, white on dark ones. Gradients and non-hex values fall back to dark text.
export function onAccentColor(accent: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(accent.trim())
  if (!m) return '#111827'
  const channel = (i: number): number => {
    const v = parseInt(m[1].slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
  return luminance > 0.18 ? '#111827' : '#ffffff'
}

// Colors of the last applied theme, so a full page load can paint it immediately.
export const THEME_COLORS_STORAGE_KEY = 'jukebox-theme-colors'

// Runs inline in <head>, before first paint, so a full page load starts in the
// user's theme instead of flashing the stylesheet default until ThemeProvider loads.
export const themeBootScript = `(function(){try{
var c=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_COLORS_STORAGE_KEY)})||'null');
if(!c)return;
var r=document.documentElement,m=${JSON.stringify(THEME_VAR_MAP)};
for(var i=0;i<m.length;i++){if(c[m[i][1]])r.style.setProperty(m[i][0],c[m[i][1]]);}
r.style.setProperty('--jukebox-on-accent',(${onAccentColor.toString()})(c.accent||''));
r.style.backgroundColor=c.background;r.style.color=c.text;
}catch(e){}})();`
