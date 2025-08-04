import { QueueTrack } from './audio'

export interface QueueStateResponse {
  isPlaying: boolean
  currentTrack: QueueTrack | null
  queue: QueueTrack[]
  progress: number
  volume: number
  isMuted: boolean
}

export interface QueueResponse extends QueueStateResponse {
  success?: boolean
  error?: string
}

export interface QueuePlayResponse extends QueueStateResponse {
  success?: boolean
  action?: string
  error?: string
}

export interface Track {
  id: string
  path: string
  title: string
  artist: string
  album: string
  duration: string
  progress?: number
  isFinished?: boolean
  estimatedDuration?: number
}

export interface ControlResponse {
  isPlaying: boolean
  isMuted?: boolean
  volume?: number
  success: boolean
  currentSong?: { file: string | null; title: string | null }
  progress?: number
}

export interface SearchResponse {
  results: SearchResult[]
}

export interface SearchResult {
  type: 'album' | 'track'
  id: string
  title: string
  artist: string
  album?: string
  path?: string
  duration?: string
}

export interface RecentlyPlayedResponse {
  tracks: RecentlyPlayedTrack[]
}

export interface RecentlyPlayedTrack {
  id: string
  path: string
  title: string
  artist: string
  album: string
  duration: string
  lastPlayed: string
}

export interface PlaylistResponse {
  id: string
  name: string
  tracks: Track[]
}

export interface NetworkInfoResponse {
  localIPs: string[]
  port: number
}

export interface SettingsResponse {
  settings: Settings
}

export interface Settings {
  musicFolder: string
  theme: string
  partyMode: boolean
  pin: string
  showTouchKeyboard: boolean
  showPaginationButtons: boolean
  showConcertDetails: boolean
  showMobileQRControl: boolean
  useMobileAlbumLayout: boolean
  showPlaybackPosition: boolean
  enableAdminMode: boolean
}

export interface ThemeResponse {
  themes: Theme[]
  theme: string
}

export interface Theme {
  id: string
  name: string
  primary: string
  secondary: string
  background: string
  text: string
} 