export interface Track {
  id: string
  title: string
  artist: string
  album: string
  path: string
  trackNumber?: number
  duration?: number
  year?: number
}

export interface Album {
  id: string
  title: string
  artist: string
  year?: number
  coverPath?: string
  folderPath?: string
  tracks: Track[]
  setlistInfo?: {
    filename: string
    content: string
  }
}

export interface Playlist {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  trackCount: number
  tracks: PlaylistTrack[]
}

export interface PlaylistTrack {
  id: string
  trackId: string
  playlistId: string
  position: number
  addedAt: string
  track: Track
  /** Filled in by GET /api/playlists/[id] from the library */
  albumId?: string
  albumTitle?: string
  coverPath?: string
  /** Track title with taper prefixes removed, as on the album screen */
  displayTitle?: string
}

export interface Theme {
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


export interface Settings {
  scanPath: string
  jukeboxName: string
  adminPin?: string
  theme: string
  showConcertDetails: boolean
  showMobileQR: boolean
  idleScreenMinutes: number
  showPlaybackPosition: boolean
  enableAdminMode: boolean
  libraryLayout: 'classic' | 'large'
  audioPlayer: 'vlc'
  partyMode: {
    enabled: boolean
    allowPlay: boolean
    allowStop: boolean
    allowNext: boolean
    allowPrevious: boolean
    allowCreatePlaylists: boolean
    allowEditPlaylists: boolean
    allowDeletePlaylists: boolean
    allowAddToQueue: boolean
    allowRemoveFromQueue: boolean
    allowSkipInQueue: boolean
  }
}

export interface CreatePlaylistRequest {
  name: string
  description?: string
}

export interface UpdatePlaylistRequest {
  name?: string
  description?: string
}

export interface AddTrackToPlaylistRequest {
  trackPath: string
  position?: number
}

export interface ReorderPlaylistRequest {
  trackIds: string[]
} 