import { NextRequest, NextResponse } from 'next/server'
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
      status?: string
      reason?: string
    }
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { directory } = await request.json() as { directory: string }
    
    // Create AbortController to handle cancellation
    const abortController = new AbortController()
    const {signal} = abortController
    
    // Handle request cancellation
    request.signal?.addEventListener('abort', () => {
      abortController.abort()
    })

    if (!directory || typeof directory !== 'string') {
      return new Response('data: {"error": "Directory path is required"}\n\n', {
        status: 400,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // Check if directory exists and is accessible
    try {
      if (!fs.existsSync(directory)) {
        return new Response(`data: {"error": "Directory does not exist or is not accessible: ${directory}"}\n\n`, {
          status: 400,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        })
      }
      
      // Try to read the directory to ensure it's accessible
      fs.readdirSync(directory)
    } catch (error) {
      return new Response(`data: {"error": "Directory is not accessible: ${directory}. ${error instanceof Error ? error.message : 'Unknown error'}"}\n\n`, {
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

        const scanSingleDirectory = async () => {
          try {
            // Send initial progress
            sendProgress({
              type: 'start',
              message: `Starting scan of ${directory}...`,
              currentDirectory: directory,
              scannedFiles: 0,
              totalFiles: 0,
              currentAlbum: ''
            })

            // Load existing library data
            const libraryPath = path.join(process.cwd(), 'data', 'music-library.json')
            let existingLibrary: MusicLibrary = {
              albums: [],
              lastScanned: new Date().toISOString(),
              totalFiles: 0,
              totalAlbums: 0,
              scanPaths: [],
              scanResults: {}
            }

            if (fs.existsSync(libraryPath)) {
              try {
                const existingData = fs.readFileSync(libraryPath, 'utf8')
                existingLibrary = JSON.parse(existingData) as MusicLibrary
              } catch (error) {
                logger.error('Error loading existing library', 'SingleScanAPI', error)
              }
            }

            // Remove existing albums from this directory
            const filteredAlbums = existingLibrary.albums.filter(album => album.folderPath !== directory)
            const filteredScanResults = { ...existingLibrary.scanResults }
            delete filteredScanResults[directory]

            // Count files in the directory
            const countFiles = async (dir: string): Promise<number> => {
              let count = 0
              try {
                if (signal.aborted) {
                  throw new Error('Scan cancelled')
                }
                
                const items = await readdir(dir)
                for (const item of items) {
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
                  throw error
                }
                logger.error(`Error counting files in ${dir}`, 'SingleScanAPI', error)
              }
              return count
            }

            sendProgress({
              type: 'counting',
              message: `Counting files in ${directory}...`,
              currentDirectory: directory,
              scannedFiles: 0,
              totalFiles: 0,
              currentAlbum: ''
            })

            const totalFiles = await countFiles(directory)

            sendProgress({
              type: 'counting_complete',
              message: `Found ${totalFiles} music files to scan`,
              currentDirectory: directory,
              scannedFiles: 0,
              totalFiles,
              currentAlbum: ''
            })

            // Scan the directory for albums
            const scanDirectory = async (dir: string, _parentAlbum?: string): Promise<Album[]> => {
              const albums: Album[] = []
              
              try {
                if (signal.aborted) {
                  throw new Error('Scan cancelled')
                }
                
                sendProgress({
                  type: 'scanning',
                  message: `Scanning directory: ${dir}`,
                  currentDirectory: dir,
                  scannedFiles: 0,
                  totalFiles,
                  currentAlbum: ''
                })
                
                const items = await readdir(dir)
                const musicFiles: string[] = []
                const subdirectories: string[] = []

                // Separate files and directories
                for (const item of items) {
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
                  
                  sendProgress({
                    type: 'album',
                    message: `Processing album: ${albumName}`,
                    currentDirectory: dir,
                    scannedFiles: 0,
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

                  // Look for setlist/info txt file
                  const txtFiles = items.filter(item => {
                    const ext = path.extname(item).toLowerCase()
                    return ext === '.txt' && !item.toLowerCase().includes('fingerprint')
                  })
                  if (txtFiles.length > 0) {
                    const [txtFile] = txtFiles
                    const txtPath = path.join(dir, txtFile)
                    try {
                      const content = fs.readFileSync(txtPath, 'utf8')
                      const lines = content
                        .split(/\r?\n/)
                        .map(line => line.trim())
                        .filter(line => line.length > 0 && !line.startsWith(';') && !line.startsWith('#'))
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
                  let scannedFiles = 0
                  for (const filePath of musicFiles) {
                    if (signal.aborted) {
                      throw new Error('Scan cancelled')
                    }
                    
                    scannedFiles++
                    
                    sendProgress({
                      type: 'file',
                      message: `Processing: ${path.basename(filePath)}`,
                      currentDirectory: dir,
                      scannedFiles,
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
                      const tMatch = fileName.match(/t(\d+)/i)
                      if (tMatch) {
                        trackNumber = parseInt(tMatch[1])
                        trackTitle = fileName.replace(/t\d+/i, '').trim()
                      }
                    }

                    // Clean up the title
                    trackTitle = trackTitle
                      .replace(/^[^a-zA-Z0-9]*/, '')
                      .replace(/[^a-zA-Z0-9]*$/, '')
                      .replace(/[-_.]+/g, ' ')
                      .trim()

                    if (!trackTitle || /^\d+$/.test(trackTitle)) {
                      trackTitle = `Track ${trackNumber ?? 'Unknown'}`
                    }

                    const track: Track = {
                      id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                      title: trackTitle,
                      artist: 'Unknown Artist',
                      album: albumName,
                      trackNumber,
                      duration: 0,
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
                  if (signal.aborted) {
                    throw new Error('Scan cancelled')
                  }
                  
                  const subAlbums = await scanDirectory(subdir, path.basename(dir))
                  albums.push(...subAlbums)
                }
              } catch (error) {
                if (signal.aborted) {
                  throw error
                }
                logger.error(`Error scanning directory ${dir}`, 'SingleScanAPI', error)
              }
              
              return albums
            }

            // Scan the single directory
            const newAlbums = await scanDirectory(directory)
            const directoryFiles = newAlbums.reduce((sum, album) => sum + album.tracks.length, 0)

            // Update library with new albums
            const updatedAlbums = [...filteredAlbums, ...newAlbums]
            const updatedScanResults = {
              ...filteredScanResults,
              [directory]: {
                albums: newAlbums.length,
                files: directoryFiles,
                lastScanned: new Date().toISOString(),
                status: 'available'
              }
            }

            // Save updated library
            const libraryData: MusicLibrary = {
              albums: updatedAlbums,
              lastScanned: new Date().toISOString(),
              totalFiles: updatedAlbums.reduce((sum, album) => sum + album.tracks.length, 0),
              totalAlbums: updatedAlbums.length,
              scanPaths: existingLibrary.scanPaths.includes(directory) 
                ? existingLibrary.scanPaths 
                : [...existingLibrary.scanPaths, directory],
              scanResults: updatedScanResults
            }

            fs.writeFileSync(libraryPath, JSON.stringify(libraryData, null, 2))

            // Send completion message
            sendProgress({
              type: 'complete',
              message: `Scan of ${directory} completed successfully!`,
              currentDirectory: directory,
              scannedFiles: directoryFiles,
              totalFiles,
              currentAlbum: '',
              result: {
                albums: newAlbums,
                totalFiles: directoryFiles,
                totalAlbums: newAlbums.length,
                directory
              }
            })

            controller.close()
          } catch (error) {
            if (error instanceof Error && error.message === 'Scan cancelled') {
              sendProgress({
                type: 'cancelled',
                message: 'Scan cancelled by user',
                currentDirectory: directory,
                scannedFiles: 0,
                totalFiles: 0,
                currentAlbum: ''
              })
            } else {
              sendProgress({
                type: 'error',
                message: 'Scan failed',
                currentDirectory: directory,
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
        void scanSingleDirectory()
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
    logger.error('Single scan error', 'SingleScanAPI', error)
    return new Response('data: {"error": "Failed to start single directory scan"}\n\n', {
      status: 500,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }
}
