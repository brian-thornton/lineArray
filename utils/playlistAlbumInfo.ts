import { Playlist } from '@/types/music'
import logger from '@/utils/serverLogger'
import { cleanAlbumTrackTitles } from '@/utils/trackTitles'
import { memoByLibrary } from '@/utils/libraryStore'

export interface LibraryTrackInfo {
  /** Song name with taper prefixes removed, as on the album screen */
  title: string
  albumId: string
  albumTitle: string
  coverPath?: string
}

/** Every library track by path, with its album and cleaned title (rebuilt when the library changes) */
function loadTrackIndex(): Map<string, LibraryTrackInfo> {
  try {
    return memoByLibrary('trackIndex', ({ albums }) => {
      const index = new Map<string, LibraryTrackInfo>()
      for (const album of albums) {
        const cleaned = cleanAlbumTrackTitles(album.tracks)
        album.tracks.forEach((track, i) => index.set(track.path, {
          title: cleaned[i].title,
          albumId: album.id,
          albumTitle: album.title,
          coverPath: album.coverPath
        }))
      }
      return index
    })
  } catch (error) {
    logger.error('Error loading music library', 'PlaylistsAPI', error)
    return new Map()
  }
}

/** Library info for the given paths; paths not in the library are left out */
export function trackInfoForPaths(paths: string[]): Record<string, LibraryTrackInfo> {
  const index = loadTrackIndex()
  const result: Record<string, LibraryTrackInfo> = {}
  for (const p of paths) {
    const info = index.get(p)
    if (info) result[p] = info
  }
  return result
}

/**
 * Attach each track's album (id, title, cover) and cleaned title from the library, so playlist
 * screens show artwork and the same song names as the album screen.
 */
export function withAlbumInfo(playlists: Playlist[]): Playlist[] {
  const index = loadTrackIndex()
  return playlists.map(playlist => ({
    ...playlist,
    tracks: playlist.tracks.map(pt => {
      const info = index.get(pt.track.path)
      if (!info) return pt
      return { ...pt, albumId: info.albumId, albumTitle: info.albumTitle, coverPath: info.coverPath, displayTitle: info.title }
    })
  }))
}
