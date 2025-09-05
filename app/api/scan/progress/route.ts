import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { Album, Track } from '@/types/music'
import logger from '@/utils/serverLogger'

const readdir = promisify(fs.readdir)
const stat = promisify(fs.stat)

const MUSIC_EXTENSIONS = ['.mp3', '.m3u', '.m4a', '.flac', '.wav', '.aac', '.ogg']
const COVER_NAMES = ['folder.jpg', 'cover.jpg', 'album.jpg', 'front.jpg']

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

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { directories } = await request.json() as { directories: string[] }
    
    // Create AbortController to handle cancellation
    const abortController = new AbortController()
    const signal = abortController.signal
    
    // Handle request cancellation
    request.signal?.addEventListener('abort', () => {
      abortController.abort()
    })

    if (!directories || !Array.isArray(directories) || directories.length === 0) {
      return new Response('data: {"error": "At least one directory is required"}\n\n', {
        status: 400,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // Create a readable stream for Server-Sent Events
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        
        const sendProgress = (data: any) => {
          const message = `data: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        }

        // Check directory accessibility and mark unavailable ones
        const directoryStatus: { [path: string]: { accessible: boolean; reason?: string } } = {}
        for (const directory of directories) {
          try {
            const accessible = fs.existsSync(directory)
            directoryStatus[directory] = { 
              accessible,
              reason: accessible ? undefined : 'Directory not found or not accessible'
            }
            
            if (!accessible) {
              sendProgress({
                type: 'unavailable',
                message: `Directory not accessible: ${directory}`,
                currentDirectory: directory,
                scannedFiles: 0,
                totalFiles: 0,
                currentAlbum: '',
                reason: 'Directory not found or not accessible'
              })
            }
          } catch (error) {
            directoryStatus[directory] = { 
              accessible: false,
              reason: 'Error checking directory accessibility'
            }
            sendProgress({
              type: 'unavailable',
              message: `Error checking directory: ${directory}`,
              currentDirectory: directory,
              scannedFiles: 0,
              totalFiles: 0,
              currentAlbum: '',
              reason: 'Error checking directory accessibility'
            })
          }
        }

        const scanWithProgress = async () => {
          try {
            const allAlbums: Album[] = []
            let totalScannedFiles = 0
            const scanResults: { [path: string]: { albums: number; files: number; lastScanned: string } } = {}

            // Send initial progress
            sendProgress({
              type: 'start',
              message: 'Starting scan...',
              currentDirectory: '',
              scannedFiles: 0,
              totalFiles: 0,
              currentAlbum: ''
            })

            // First pass: count total files across all directories
            const countFiles = async (dir: string): Promise<number> => {
              let count = 0
              try {
                // Check for cancellation
                if (signal.aborted) {
                  throw new Error('Scan cancelled')
                }
                
                const items = await readdir(dir)
                for (const item of items) {
                  // Check for cancellation in loop
                  if (signal.aborted) {
                    throw new Error('Scan cancelled')
                  }
                  
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
                if (signal.aborted) {
                  throw error // Re-throw cancellation errors
                }
                logger.error(`Error counting files in ${dir}`, 'ScanAPI', error)
              }
              return count
            }

            // Count files in accessible directories only
            let totalFiles = 0
            for (const directory of directories) {
              if (signal.aborted) {
                throw new Error('Scan cancelled')
              }
              
              if (!directoryStatus[directory]?.accessible) {
                sendProgress({
                  type: 'skipping',
                  message: `Skipping unavailable directory: ${directory}`,
                  currentDirectory: directory,
                  scannedFiles: 0,
                  totalFiles: 0,
                  currentAlbum: ''
                })
                continue
              }
              
              sendProgress({
                type: 'counting',
                message: `Counting files in ${directory}...`,
                currentDirectory: directory,
                scannedFiles: 0,
                totalFiles: 0,
                currentAlbum: ''
              })
              totalFiles += await countFiles(directory)
            }

            // Send total file count
            sendProgress({
              type: 'counting_complete',
              message: `Found ${totalFiles} music files to scan`,
              currentDirectory: '',
              scannedFiles: 0,
              totalFiles,
              currentAlbum: ''
            })

            // Second pass: scan for albums in each directory
            const scanDirectory = async (dir: string, _parentAlbum?: string): Promise<Album[]> => {
              const albums: Album[] = []
              
              try {
                // Check for cancellation
                if (signal.aborted) {
                  throw new Error('Scan cancelled')
                }
                
                // Send progress update for current directory
                sendProgress({
                  type: 'scanning',
                  message: `Scanning directory: ${dir}`,
                  currentDirectory: dir,
                  scannedFiles: totalScannedFiles,
                  totalFiles,
                  currentAlbum: ''
                })
                
                const items = await readdir(dir)
                const musicFiles: string[] = []
                const subdirectories: string[] = []

                // Separate files and directories
                for (const item of items) {
                  // Check for cancellation in loop
                  if (signal.aborted) {
                    throw new Error('Scan cancelled')
                  }
                  
                  const fullPath = path.join(dir, item)
                  const stats = await stat(fullPath)
                  
                  if (stats.isDirectory()) {
                    subdirectories.push(fullPath)
                  } else if (stats.isFile()) {
                    // Skip macOS metadata files (resource forks)
                    if (item.startsWith('._')) {
                      continue
                    }
                    
                    const ext = path.extname(item).toLowerCase()
                    if (MUSIC_EXTENSIONS.includes(ext)) {
                      musicFiles.push(fullPath)
                    }
                  }
                }

                // If this directory has music files, it's a potential album
                if (musicFiles.length > 0) {
                  const albumName = path.basename(dir)
                  
                  // Send progress update for current album
                  sendProgress({
                    type: 'album',
                    message: `Processing album: ${albumName}`,
                    currentDirectory: dir,
                    scannedFiles: totalScannedFiles,
                    totalFiles,
                    currentAlbum: albumName
                  })
                  
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

                  // Look for setlist/info txt file (excluding 'fingerprint' in the name)
                  const txtFiles = items.filter(item => {
                    const ext = path.extname(item).toLowerCase()
                    return ext === '.txt' && !item.toLowerCase().includes('fingerprint')
                  })
                  if (txtFiles.length > 0) {
                    const [txtFile] = txtFiles
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
                    // Check for cancellation in file processing loop
                    if (signal.aborted) {
                      throw new Error('Scan cancelled')
                    }
                    
                    totalScannedFiles++
                    
                    // Send progress update for current file
                    sendProgress({
                      type: 'file',
                      message: `Processing: ${path.basename(filePath)}`,
                      currentDirectory: dir,
                      scannedFiles: totalScannedFiles,
                      totalFiles,
                      currentAlbum: albumName
                    })
                    
                    const fileName = path.basename(filePath, path.extname(filePath))
                    let trackTitle = fileName
                    let trackNumber: number | undefined = undefined

                    // Try to extract track number from filename
                    const trackMatch = fileName.match(/^(\d+)[\s\-_.]+(.+)$/)
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
                      .replace(/[-_.]+/g, ' ') // Replace multiple dashes/underscores/dots with space
                      .trim()

                    // If title is empty or just numbers, use a default
                    if (!trackTitle || /^\d+$/.test(trackTitle)) {
                      trackTitle = `Track ${trackNumber ?? 'Unknown'}`
                    }

                    const track: Track = {
                      id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                      title: trackTitle,
                      artist: 'Unknown Artist',
                      album: albumName,
                      trackNumber,
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

                // Recursively scan subdirectories
                for (const subdir of subdirectories) {
                  // Check for cancellation before each subdirectory
                  if (signal.aborted) {
                    throw new Error('Scan cancelled')
                  }
                  
                  const subAlbums = await scanDirectory(subdir, path.basename(dir))
                  albums.push(...subAlbums)
                }
              } catch (error) {
                if (signal.aborted) {
                  throw error // Re-throw cancellation errors
                }
                logger.error(`Error scanning directory ${dir}`, 'ScanAPI', error)
              }
              
              return albums
            }

            // Scan each accessible directory and collect results
            for (const directory of directories) {
              // Check for cancellation before each directory
              if (signal.aborted) {
                throw new Error('Scan cancelled')
              }
              
              if (!directoryStatus[directory]?.accessible) {
                // Mark unavailable directories in scan results
                scanResults[directory] = {
                  albums: 0,
                  files: 0,
                  lastScanned: new Date().toISOString(),
                  status: 'unavailable',
                  reason: directoryStatus[directory]?.reason
                }
                continue
              }
              
              const directoryAlbums = await scanDirectory(directory)
              const directoryFiles = directoryAlbums.reduce((sum, album) => sum + album.tracks.length, 0)
              
              scanResults[directory] = {
                albums: directoryAlbums.length,
                files: directoryFiles,
                lastScanned: new Date().toISOString(),
                status: 'available'
              }
              
              allAlbums.push(...directoryAlbums)
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

            // Send completion message
            sendProgress({
              type: 'complete',
              message: 'Scan completed successfully!',
              currentDirectory: '',
              scannedFiles: totalScannedFiles,
              totalFiles,
              currentAlbum: '',
              result: {
                albums: allAlbums,
                totalFiles: totalScannedFiles,
                totalAlbums: allAlbums.length,
                scanPaths: directories,
                scanResults
              }
            })

            controller.close()
          } catch (error) {
            if (error instanceof Error && error.message === 'Scan cancelled') {
              sendProgress({
                type: 'cancelled',
                message: 'Scan cancelled by user',
                currentDirectory: '',
                scannedFiles: 0,
                totalFiles: 0,
                currentAlbum: ''
              })
            } else {
              sendProgress({
                type: 'error',
                message: 'Scan failed',
                currentDirectory: '',
                scannedFiles: 0,
                totalFiles: 0,
                currentAlbum: '',
                error: error instanceof Error ? error.message : 'Unknown error'
              })
            }
            controller.close()
          }
        }

        // Start the scan
        void scanWithProgress()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    })

  } catch (error) {
    logger.error('Scan progress error', 'ScanProgressAPI', error)
    return new Response('data: {"error": "Failed to start scan"}\n\n', {
      status: 500,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }
}
