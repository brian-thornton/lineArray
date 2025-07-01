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