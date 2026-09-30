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

// Colors of the last applied theme, so a full page load can paint it immediately.
export const THEME_COLORS_STORAGE_KEY = 'jukebox-theme-colors'

// Runs inline in <head>, before first paint, so a full page load starts in the
// user's theme instead of flashing the stylesheet default until ThemeProvider loads.
export const themeBootScript = `(function(){try{
var c=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_COLORS_STORAGE_KEY)})||'null');
if(!c)return;
var r=document.documentElement,m=${JSON.stringify(THEME_VAR_MAP)};
for(var i=0;i<m.length;i++){if(c[m[i][1]])r.style.setProperty(m[i][0],c[m[i][1]]);}
r.style.backgroundColor=c.background;r.style.color=c.text;
}catch(e){}})();`
