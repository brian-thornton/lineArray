import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { Album, Track } from '@/types/music'

const readdir = promisify(fs.readdir)
const stat = promisify(fs.stat)

const MUSIC_EXTENSIONS = ['.mp3', '.m3u', '.m4a', '.flac', '.wav', '.aac', '.ogg']
const COVER_NAMES = ['folder.jpg', 'cover.jpg', 'album.jpg', 'front.jpg']

interface ScanProgress {
  currentFile: string
  scannedFiles: number
  totalFiles: number
  currentAlbum: string
}

interface MusicLibrary {
  albums: Album[]
  lastScanned: string
  totalFiles: number
  totalAlbums: number
  scanPaths: string[]
  scanResults: {
    [path: string]: {
      albums: number
      files: number
      lastScanned: string
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { directories } = await request.json()

    if (!directories || !Array.isArray(directories) || directories.length === 0) {
      return NextResponse.json({ error: 'At least one directory is required' }, { status: 400 })
    }

    console.log('🚀 Starting music library scan...')
    console.log('📂 Scan directories:', directories)

    // Validate all directories exist
    for (const directory of directories) {
      if (!fs.existsSync(directory)) {
        return NextResponse.json({ error: `Directory does not exist: ${directory}` }, { status: 400 })
      }
    }

    const allAlbums: Album[] = []
    let totalScannedFiles = 0
    let totalFiles = 0
    const scanResults: { [path: string]: { albums: number; files: number; lastScanned: string } } = {}

    // First pass: count total files across all directories
    console.log('📊 Counting total files...')
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

    // Count files in all directories
    for (const directory of directories) {
      const dirCount = await countFiles(directory)
      console.log(`📊 Found ${dirCount} music files in ${directory}`)
      totalFiles += dirCount
    }

    console.log(`📊 Total music files to scan: ${totalFiles}`)

    // Second pass: scan for albums in each directory
    const scanDirectory = async (dir: string, parentAlbum?: string): Promise<Album[]> => {
      const albums: Album[] = []
      
      try {
        console.log(`🔍 Scanning directory: ${dir}`)
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

        console.log(`  📁 Found ${subdirectories.length} subdirectories:`, subdirectories.map(d => path.basename(d)))
        console.log(`  🎵 Found ${musicFiles.length} music files:`, musicFiles.map(f => path.basename(f)))

        // If this directory has music files, it's a potential album
        if (musicFiles.length > 0) {
          console.log(`  ✅ Creating album from: ${dir}`)
          // Always treat directories with music files as potential albums
          // This handles cases like:
          // - Artist/Album/tracks (traditional structure)
          // - Genre/Artist/Album/tracks (nested structure)
          // - Year/Artist/Album/tracks (nested structure)
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
              console.log(`  🖼️  Found cover: ${coverName}`)
              break
            }
          }

          // Look for setlist/info txt file (excluding 'fingerprint' in the name)
          const txtFiles = items.filter(item => {
            const ext = path.extname(item).toLowerCase()
            return ext === '.txt' && !item.toLowerCase().includes('fingerprint')
          })
          if (txtFiles.length > 0) {
            const txtFile = txtFiles[0]
            console.log(`  📄 Found setlist file: ${txtFile}`)
            const txtPath = path.join(dir, txtFile)
            try {
              const content = fs.readFileSync(txtPath, 'utf8')
              // Split into lines, remove blank and comment lines
              const lines = content
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(line => line.length > 0 && !line.startsWith(';') && !line.startsWith('#'))
              // If all remaining lines are fingerprints, skip
              const isAllFingerprint = lines.length > 0 && lines.every(line => /.+\.[a-z0-9]+:[a-f0-9]{32,}/i.test(line))
              if (!isAllFingerprint) {
                album.setlistInfo = {
                  filename: txtFile,
                  content
                }
              }
            } catch (e) {
              // Ignore read errors
            }
          }

          // Process music files
          for (const filePath of musicFiles) {
            totalScannedFiles++
            
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
            console.log(`  🎵 Created album "${albumName}" with ${album.tracks.length} tracks`)
            albums.push(album)
          }
        } else {
          console.log(`  ⏭️  Skipping directory (no music files): ${dir}`)
        }

        // Recursively scan subdirectories
        console.log(`  🔄 Recursively scanning ${subdirectories.length} subdirectories...`)
        for (const subdir of subdirectories) {
          const subAlbums = await scanDirectory(subdir, path.basename(dir))
          albums.push(...subAlbums)
        }
      } catch (error) {
        console.error(`❌ Error scanning directory ${dir}:`, error)
      }
      
      return albums
    }

    // Scan each directory and collect results
    for (const directory of directories) {
      console.log(`\n🎯 Scanning directory: ${directory}`)
      const directoryAlbums = await scanDirectory(directory)
      const directoryFiles = directoryAlbums.reduce((sum, album) => sum + album.tracks.length, 0)
      
      console.log(`✅ Completed scan of ${directory}:`)
      console.log(`   📁 Found ${directoryAlbums.length} albums`)
      console.log(`   🎵 Found ${directoryFiles} tracks`)
      
      scanResults[directory] = {
        albums: directoryAlbums.length,
        files: directoryFiles,
        lastScanned: new Date().toISOString()
      }
      
      allAlbums.push(...directoryAlbums)
    }

    console.log(`\n🎉 Scan completed!`)
    console.log(`📊 Final results:`)
    console.log(`   📁 Total albums found: ${allAlbums.length}`)
    console.log(`   🎵 Total tracks found: ${totalScannedFiles}`)
    console.log(`   📂 Albums by directory:`)
    for (const [dir, result] of Object.entries(scanResults)) {
      console.log(`      ${dir}: ${result.albums} albums, ${result.files} tracks`)
    }

    // Save to JSON file with new structure
    const libraryData: MusicLibrary = {
      albums: allAlbums,
      lastScanned: new Date().toISOString(),
      totalFiles: totalScannedFiles,
      totalAlbums: allAlbums.length,
      scanPaths: directories,
      scanResults
    }

    const libraryPath = path.join(process.cwd(), 'data', 'music-library.json')
    fs.writeFileSync(libraryPath, JSON.stringify(libraryData, null, 2))
    console.log(`💾 Saved library to: ${libraryPath}`)

    return NextResponse.json({
      success: true,
      albums: allAlbums,
      totalFiles: totalScannedFiles,
      totalAlbums: allAlbums.length,
      scanPaths: directories,
      scanResults
    })

  } catch (error) {
    console.error('Scan error:', error)
    return NextResponse.json(
      { error: 'Failed to scan directories' },
      { status: 500 }
    )
  }
} 