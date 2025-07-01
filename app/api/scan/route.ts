import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { Album, Track } from '@/types/music'

const readdir = promisify(fs.readdir)
const stat = promisify(fs.stat)

const MUSIC_EXTENSIONS = ['.mp3', '.m3u']
const COVER_NAMES = ['folder.jpg', 'cover.jpg', 'album.jpg', 'front.jpg']

interface ScanProgress {
  currentFile: string
  scannedFiles: number
  totalFiles: number
  currentAlbum: string
}

export async function POST(request: NextRequest) {
  try {
    const { directory } = await request.json()

    if (!directory) {
      return NextResponse.json({ error: 'Directory is required' }, { status: 400 })
    }

    // Check if directory exists
    if (!fs.existsSync(directory)) {
      return NextResponse.json({ error: 'Directory does not exist' }, { status: 400 })
    }

    const albums: Album[] = []
    let scannedFiles = 0
    let totalFiles = 0

    // First pass: count total files
    const countFiles = async (dir: string): Promise<number> => {
      let count = 0
      try {
        const items = await readdir(dir)
        for (const item of items) {
          const fullPath = path.join(dir, item)
          const stats = await stat(fullPath)
          
          if (stats.isDirectory()) {
            count += await countFiles(fullPath)
          } else if (stats.isFile()) {
            const ext = path.extname(item).toLowerCase()
            if (MUSIC_EXTENSIONS.includes(ext)) {
              count++
            }
          }
        }
      } catch (error) {
        console.error(`Error counting files in ${dir}:`, error)
      }
      return count
    }

    totalFiles = await countFiles(directory)

    // Second pass: scan for albums
    const scanDirectory = async (dir: string, parentAlbum?: string): Promise<void> => {
      try {
        const items = await readdir(dir)
        const musicFiles: string[] = []
        const subdirectories: string[] = []

        // Separate files and directories
        for (const item of items) {
          const fullPath = path.join(dir, item)
          const stats = await stat(fullPath)
          
          if (stats.isDirectory()) {
            subdirectories.push(fullPath)
          } else if (stats.isFile()) {
            const ext = path.extname(item).toLowerCase()
            if (MUSIC_EXTENSIONS.includes(ext)) {
              musicFiles.push(fullPath)
            }
          }
        }

        // If this directory has music files, it's a potential album
        if (musicFiles.length > 0) {
          // Check if any subdirectories also have music files
          let hasMusicSubdirs = false
          for (const subdir of subdirectories) {
            const subItems = await readdir(subdir)
            for (const subItem of subItems) {
              const subPath = path.join(subdir, subItem)
              const subStats = await stat(subPath)
              if (subStats.isFile()) {
                const ext = path.extname(subItem).toLowerCase()
                if (MUSIC_EXTENSIONS.includes(ext)) {
                  hasMusicSubdirs = true
                  break
                }
              }
            }
            if (hasMusicSubdirs) break
          }

          // Only treat as album if no subdirectories have music files
          if (!hasMusicSubdirs) {
            const albumName = path.basename(dir)
            const album: Album = {
              id: `album_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              title: albumName,
              artist: 'Unknown Artist',
              year: undefined,
              coverPath: undefined,
              tracks: [],
              folderPath: dir
            }

            // Look for cover image
            for (const coverName of COVER_NAMES) {
              const coverPath = path.join(dir, coverName)
              if (fs.existsSync(coverPath)) {
                album.coverPath = coverPath
                break
              }
            }

            // Process music files
            for (const filePath of musicFiles) {
              scannedFiles++
              
              const fileName = path.basename(filePath, path.extname(filePath))
              let trackTitle = fileName
              let trackNumber: number | undefined = undefined

              // Try to extract track number from filename
              const trackMatch = fileName.match(/^(\d+)[\s\-_\.]+(.+)$/)
              if (trackMatch) {
                trackNumber = parseInt(trackMatch[1])
                trackTitle = trackMatch[2].trim()
              }

              // Try to extract track number from common patterns
              if (!trackNumber) {
                // Pattern: t01, t02, etc.
                const tMatch = fileName.match(/t(\d+)/i)
                if (tMatch) {
                  trackNumber = parseInt(tMatch[1])
                  // Remove the track number part from title
                  trackTitle = fileName.replace(/t\d+/i, '').trim()
                }
              }

              // Clean up the title - remove common prefixes and suffixes
              trackTitle = trackTitle
                .replace(/^[^a-zA-Z0-9]*/, '') // Remove leading non-alphanumeric
                .replace(/[^a-zA-Z0-9]*$/, '') // Remove trailing non-alphanumeric
                .replace(/[-_\.]+/g, ' ') // Replace multiple dashes/underscores/dots with space
                .trim()

              // If title is empty or just numbers, use a default
              if (!trackTitle || /^\d+$/.test(trackTitle)) {
                trackTitle = `Track ${trackNumber || 'Unknown'}`
              }

              const track: Track = {
                id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                title: trackTitle,
                artist: 'Unknown Artist',
                album: albumName,
                trackNumber: trackNumber,
                duration: 0, // Would need audio library to get actual duration
                path: filePath
              }

              album.tracks.push(track)
            }

            // Sort tracks by track number
            album.tracks.sort((a, b) => {
              if (a.trackNumber && b.trackNumber) {
                return a.trackNumber - b.trackNumber
              }
              return 0
            })

            if (album.tracks.length > 0) {
              albums.push(album)
            }
          }
        }

        // Recursively scan subdirectories
        for (const subdir of subdirectories) {
          await scanDirectory(subdir, path.basename(dir))
        }
      } catch (error) {
        console.error(`Error scanning directory ${dir}:`, error)
      }
    }

    await scanDirectory(directory)

    // Save to JSON file
    const libraryData = {
      albums,
      lastScanned: new Date().toISOString(),
      totalFiles: scannedFiles,
      totalAlbums: albums.length,
      scanPath: directory
    }

    fs.writeFileSync(
      path.join(process.cwd(), 'data', 'music-library.json'),
      JSON.stringify(libraryData, null, 2)
    )

    return NextResponse.json({
      success: true,
      albums,
      totalFiles: scannedFiles,
      totalAlbums: albums.length
    })

  } catch (error) {
    console.error('Scan error:', error)
    return NextResponse.json(
      { error: 'Failed to scan directory' },
      { status: 500 }
    )
  }
} 