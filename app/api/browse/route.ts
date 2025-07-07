import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs-extra'
import path from 'path'

interface FileItem {
  name: string
  path: string
  isDirectory: boolean
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { path: browsePath } = await request.json() as { path: string }
    
    const targetPath = browsePath ?? '/'
    
    // If no path provided, return system root directories
    if (!browsePath) {
      const systemRoots = await getSystemRoots()
      return NextResponse.json({ items: systemRoots })
    }

    // Check if directory exists
    if (!(await fs.pathExists(targetPath))) {
      return NextResponse.json(
        { error: 'Directory does not exist' },
        { status: 400 }
      )
    }

    const stat = await fs.stat(targetPath)
    if (!stat.isDirectory()) {
      return NextResponse.json(
        { error: 'Path must be a directory' },
        { status: 400 }
      )
    }

    // Read directory contents
    const items = await fs.readdir(targetPath)
    const fileItems: FileItem[] = []

    for (const item of items) {
      try {
        const fullPath = path.join(targetPath, item)
        const itemStat = await fs.stat(fullPath)
        
        // Skip hidden files and system files
        if (item.startsWith('.') && !item.startsWith('..')) {
          continue
        }

        fileItems.push({
          name: item,
          path: fullPath,
          isDirectory: itemStat.isDirectory()
        })
      } catch (error) {
        // Skip items we can't access
        console.error(`Error accessing ${item}:`, error)
      }
    }

    // Sort: directories first, then files, both alphabetically
    fileItems.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({ items: fileItems })
  } catch (error) {
    console.error('Error browsing directory:', error)
    return NextResponse.json(
      { error: 'Failed to browse directory' },
      { status: 500 }
    )
  }
}

async function getSystemRoots(): Promise<FileItem[]> {
  const roots: FileItem[] = []
  
  try {
    // On macOS/Linux, add common root directories
    const commonRoots = ['/', '/Users', '/Volumes']
    
    for (const root of commonRoots) {
      if (await fs.pathExists(root)) {
        const stat = await fs.stat(root)
        if (stat.isDirectory()) {
          roots.push({
            name: root === '/' ? 'Root' : path.basename(root),
            path: root,
            isDirectory: true
          })
        }
      }
    }

    // Add user's home directory
    const homeDir = process.env.HOME ?? process.env.USERPROFILE
    if (homeDir && await fs.pathExists(homeDir)) {
      roots.push({
        name: 'Home',
        path: homeDir,
        isDirectory: true
      })
    }

    // Add mounted volumes on macOS
    const volumesPath = '/Volumes'
    if (await fs.pathExists(volumesPath)) {
      try {
        const volumes = await fs.readdir(volumesPath)
        for (const volume of volumes) {
          if (volume !== 'Macintosh HD') { // Skip the main system volume
            const volumePath = path.join(volumesPath, volume)
            const stat = await fs.stat(volumePath)
            if (stat.isDirectory()) {
              roots.push({
                name: volume,
                path: volumePath,
                isDirectory: true
              })
            }
          }
        }
      } catch (error) {
        console.error('Error reading volumes:', error)
      }
    }
  } catch (error) {
    console.error('Error getting system roots:', error)
  }

  return roots.sort((a, b) => a.name.localeCompare(b.name))
} 