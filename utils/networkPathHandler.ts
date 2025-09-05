import path from 'path'
import fs from 'fs'

/**
 * Handles network share paths for cross-platform compatibility
 * Specifically handles Windows SMB shares accessed from Mac
 */
export class NetworkPathHandler {
  
  /**
   * Normalizes a file path for playback, handling network shares
   * @param filePath The original file path
   * @returns Normalized path suitable for audio playback
   */
  static normalizePathForPlayback(filePath: string): string {
    console.log('🌐 Network Path Handler: Normalizing path:', filePath)
    console.log('🌐 Network Path Handler: Path type check:', {
      isNetworkShare: this.isNetworkSharePath(filePath),
      startsWithVolumes: filePath.startsWith('/Volumes/'),
      startsWithSMB: filePath.startsWith('smb://'),
      startsWithCIFS: filePath.startsWith('cifs://'),
      startsWithUNC: filePath.startsWith('\\\\')
    })
    
    // Check if this is a network share path
    if (this.isNetworkSharePath(filePath)) {
      console.log('🌐 Network Path Handler: Detected network share path')
      const pathOptions = this.handleNetworkSharePath(filePath)
      // Return the first option as the primary path
      const primaryPath = pathOptions[0]
      console.log('🌐 Network Path Handler: Primary normalized result:', primaryPath)
      return primaryPath
    }
    
    // For local paths, just normalize separators
    const localNormalized = path.normalize(filePath)
    console.log('🌐 Network Path Handler: Local path normalized:', localNormalized)
    return localNormalized
  }

  /**
   * Gets all possible path options for a network share file
   * @param filePath The original file path
   * @returns Array of path options to try for playback
   */
  static getNetworkSharePathOptions(filePath: string): string[] {
    if (this.isNetworkSharePath(filePath)) {
      return this.handleNetworkSharePath(filePath)
    }
    return [filePath]
  }
  
  /**
   * Checks if a path is a network share
   */
  static isNetworkSharePath(filePath: string): boolean {
    // Check for common network share patterns
    const networkPatterns = [
      /^\/Volumes\//,           // Mac mounted network volumes
      /^\/mnt\//,              // Linux mounted network shares
      /^\/media\//,            // Linux mounted media
      /^\\\\/,                 // Windows UNC paths
      /^smb:\/\//,             // SMB URLs
      /^cifs:\/\//,            // CIFS URLs
    ]
    
    return networkPatterns.some(pattern => pattern.test(filePath))
  }
  
  /**
   * Handles network share path conversion for VLC
   * Returns multiple path options to try, as VLC can be picky about network share formats
   */
  static handleNetworkSharePath(filePath: string): string[] {
    console.log('🌐 Network Path Handler: Processing network share path:', filePath)
    
    const pathOptions: string[] = []
    
    // Handle Mac mounted network volumes (/Volumes/...)
    if (filePath.startsWith('/Volumes/')) {
      console.log('🌐 Network Path Handler: Processing Mac mounted volume')
      
      // Option 1: Try the mounted path as-is (sometimes works)
      pathOptions.push(filePath)
      console.log('🌐 Network Path Handler: Option 1 - Mounted volume path:', filePath)
      
      // Option 2: Try to convert to SMB URL format
      // Extract share name and path from /Volumes/ShareName/path
      const pathParts = filePath.split('/')
      if (pathParts.length >= 4) {
        const shareName = pathParts[2] // ShareName
        const relativePath = pathParts.slice(3).join('/') // path within share
        
        // Try common SMB server patterns
        const smbOptions = [
          `smb://${shareName}/${relativePath}`,
          `smb://localhost/${shareName}/${relativePath}`,
          `smb://127.0.0.1/${shareName}/${relativePath}`,
          `smb://${shareName}.local/${relativePath}`
        ]
        
        pathOptions.push(...smbOptions)
        console.log('🌐 Network Path Handler: Options 2-5 - SMB URL variants:', smbOptions)
      }
      
      // Option 3: Try file:// URL format (sometimes VLC prefers this)
      const fileUrl = `file://${filePath}`
      pathOptions.push(fileUrl)
      console.log('🌐 Network Path Handler: Option 6 - File URL:', fileUrl)
      
      return pathOptions
    }
    
    // Handle Windows UNC paths (\\server\share\path)
    if (filePath.startsWith('\\\\')) {
      console.log('🌐 Network Path Handler: Processing Windows UNC path')
      
      // Option 1: Convert to SMB URL format
      const uncPath = filePath.replace(/\\/g, '/')
      const smbPath = `smb:${uncPath}`
      pathOptions.push(smbPath)
      console.log('🌐 Network Path Handler: Option 1 - SMB URL:', smbPath)
      
      // Option 2: Try the UNC path as-is (sometimes works on Windows)
      pathOptions.push(filePath)
      console.log('🌐 Network Path Handler: Option 2 - UNC path:', filePath)
      
      return pathOptions
    }
    
    // Handle SMB URLs - VLC supports these directly
    if (filePath.startsWith('smb://') || filePath.startsWith('cifs://')) {
      console.log('🌐 Network Path Handler: SMB/CIFS URL detected - VLC supports these')
      pathOptions.push(filePath)
      return pathOptions
    }
    
    // If we can't determine the format, return the original path
    console.log('🌐 Network Path Handler: Unknown network share format, returning original')
    pathOptions.push(filePath)
    return pathOptions
  }
  
  /**
   * Checks if a network share path is accessible
   */
  static async isNetworkPathAccessible(filePath: string): Promise<boolean> {
    try {
      // For network paths, we need to be more careful about checking accessibility
      if (this.isNetworkSharePath(filePath)) {
        console.log('🌐 Network Path Handler: Checking network path accessibility:', filePath)
        
        // For mounted volumes, check if the mount point exists
        if (filePath.startsWith('/Volumes/')) {
          const mountPoint = filePath.split('/').slice(0, 3).join('/') // Get /Volumes/ShareName
          const mountExists = fs.existsSync(mountPoint)
          console.log('🌐 Network Path Handler: Mount point exists:', mountExists, 'at:', mountPoint)
          
          if (!mountExists) {
            console.log('🌐 Network Path Handler: Mount point does not exist - share may be unmounted')
            return false
          }
          
          // Check if the specific file exists
          try {
            const fileExists = fs.existsSync(filePath)
            console.log('🌐 Network Path Handler: File exists at mounted path:', fileExists)
            
            if (fileExists) {
              // Try to access the file with read permissions
              await fs.promises.access(filePath, fs.constants.R_OK)
              console.log('🌐 Network Path Handler: Network path is accessible and readable')
              return true
            } else {
              console.log('🌐 Network Path Handler: File does not exist at mounted path')
              return false
            }
          } catch (accessError) {
            console.log('🌐 Network Path Handler: File exists but is not accessible:', (accessError as Error).message)
            return false
          }
        }
        
        // For other network share types (SMB URLs, UNC paths), we can't easily check accessibility
        // without actually trying to access them, so we'll return true and let VLC handle it
        console.log('🌐 Network Path Handler: Cannot pre-check accessibility for this network share type, will let VLC handle it')
        return true
      } else {
        // For local paths, use standard existsSync
        const exists = fs.existsSync(filePath)
        console.log('🌐 Network Path Handler: Local path exists:', exists)
        return exists
      }
    } catch (error) {
      console.log('🌐 Network Path Handler: Network path not accessible:', (error as Error).message)
      return false
    }
  }
  
  /**
   * Checks if a network share is properly mounted
   */
  static isNetworkShareMounted(filePath: string): boolean {
    if (!this.isNetworkSharePath(filePath)) {
      return true // Local paths are always "mounted"
    }
    
    if (filePath.startsWith('/Volumes/')) {
      const mountPoint = filePath.split('/').slice(0, 3).join('/') // Get /Volumes/ShareName
      const mounted = fs.existsSync(mountPoint)
      console.log('🌐 Network Path Handler: Checking if mount point exists:', mountPoint, 'exists:', mounted)
      return mounted
    }
    
    // For other network share types, assume they're accessible if the path handler detected them
    return true
  }
  
  /**
   * Escapes a path for use in shell commands
   */
  static escapePathForShell(filePath: string): string {
    // Handle different types of paths
    if (filePath.startsWith('smb://') || filePath.startsWith('cifs://')) {
      // For SMB URLs, we need to escape them properly
      return filePath.replace(/"/g, '\\"').replace(/'/g, "\\'")
    } else {
      // For regular paths, use standard escaping
      return filePath.replace(/"/g, '\\"')
    }
  }
  
  /**
   * Gets the appropriate command for playing network share files
   * Note: This is mainly for compatibility - VLC handles network shares via HTTP API
   */
  static getPlaybackCommand(filePath: string): { command: string; args: string[] } {
    if (this.isNetworkSharePath(filePath)) {
      console.log('🌐 Network Path Handler: Network share detected - VLC will handle via HTTP API')
      
      // VLC handles network shares through its HTTP API, not direct command line
      // This method is mainly for compatibility with the interface
      return {
        command: 'vlc',
        args: [filePath]
      }
    }
    
    // For local files, VLC can handle these too
    return {
      command: 'vlc',
      args: [filePath]
    }
  }
}
