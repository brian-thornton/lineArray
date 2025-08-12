import { exec, type ChildProcess } from 'child_process'
import fs from 'fs'
import logger from './utils/serverLogger'
import type { AudioStatus, CurrentSong, AudioManagerInterface } from './types/audio'

class MPDManager implements AudioManagerInterface {
  private currentProcess: ChildProcess | null = null
  private isPlaying = false
  private currentFile: string | null = null
  private readonly platform: string
  private volume = 1.0
  private muted = false
  private playbackStartTime: number | null = null
  private estimatedDuration = 0 // in seconds
  private wasPlayingBeforeKill = false
  private onTrackComplete: (() => void) | null = null
  private progressInterval: NodeJS.Timeout | null = null
  private progressCallback: ((progress: number) => void) | null = null
  private latestProgress: number = 0
  private latestProgressPercentage: number = 0
  private mpdHost: string = 'localhost'
  private mpdPort: number = 6600
  private mpdPassword: string = ''
  private readonly mpcPath: string = '/opt/homebrew/bin/mpc'

  constructor() {
    console.log('🎵 MPD Manager: Constructor called!')
    this.platform = process.platform
    console.log('🎵 MPD Manager: Platform:', this.platform)
    logger.info('MPD Manager: Initialized for platform: ' + this.platform, 'MPDManager')
    
    // Query system volume on startup
    this.querySystemVolumeOnStartup()
    
    // Ensure VLC is completely stopped when MPD is initialized
    this.ensureVLCStopped()
    
    console.log('✅ MPD Manager: Constructor completed successfully')
  }

  // Ensure VLC is completely stopped to prevent conflicts
  private ensureVLCStopped(): void {
    try {
      logger.info('MPD Manager: Ensuring VLC is stopped to prevent conflicts', 'MPDManager')
      if (this.platform === 'win32') {
        exec('taskkill /f /im vlc.exe', () => {})
      } else {
        exec('pkill -f vlc', () => {})
        exec('pkill -f "vlc --intf http"', () => {})
      }
    } catch (error) {
      // Ignore VLC cleanup errors
    }
  }

  // Query system volume on startup and sync our internal state
  private async querySystemVolumeOnStartup(): Promise<void> {
    try {
      let command: string
      
      if (this.platform === 'win32') {
        command = 'powershell -Command "[math]::Round((Get-AudioDevice -Playback).Volume / 100, 2)"'
      } else {
        command = 'osascript -e "output volume of (get volume settings)"'
      }
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.info('MPD Manager: Error querying system volume: ' + error.message, 'MPDManager')
          logger.info('MPD Manager: Using default volume: ' + this.volume, 'MPDManager')
        } else {
          try {
            const systemVolume = parseFloat(stdout.trim())
            if (!isNaN(systemVolume)) {
              const normalizedVolume = this.platform === 'win32' ? systemVolume : systemVolume / 100
              this.volume = Math.max(0, Math.min(1, normalizedVolume))
              logger.info('MPD Manager: System volume queried on startup: ' + Math.round(this.volume * 100) + '%', 'MPDManager')
            } else {
              logger.info('MPD Manager: Invalid system volume response, using default: ' + this.volume, 'MPDManager')
            }
          } catch (parseError) {
            logger.info('MPD Manager: Error parsing system volume, using default: ' + this.volume, 'MPDManager')
          }
        }
      })
    } catch (error) {
      logger.error('MPD Manager: Error in querySystemVolumeOnStartup', 'MPDManager', error)
    }
  }

  // Set the completion callback
  setTrackCompleteCallback(callback: () => void): void {
    this.onTrackComplete = callback
  }

  clearTrackCompleteCallback(): void {
    this.onTrackComplete = null
  }

  // Method to clear callback when user actually wants to stop (not just change tracks)
  clearCallbackForStop(): void {
    this.onTrackComplete = null
  }

  setProgressCallback(callback: (progress: number) => void): void {
    this.progressCallback = callback
  }

  getLatestProgress(): number {
    return this.latestProgress
  }

  private startProgressPolling(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval)
    }
    
    this.progressInterval = setInterval(async () => {
      try {
        const progress = await this.getMPDProgress()
        const duration = await this.getMPDDuration()
        
        this.latestProgress = progress
        
        // Calculate percentage (0-1) for the UI
        if (duration > 0) {
          this.latestProgressPercentage = progress / duration
        } else {
          this.latestProgressPercentage = 0
        }
        
        if (this.progressCallback) {
          // Send the percentage (0-1) to the UI, not raw seconds
          this.progressCallback(this.latestProgressPercentage)
        }
        
        // Check MPD's actual status to see if track is finished
        const status = await this.getMPDStatus()
        if (status === 'stopped' && this.isPlaying && this.onTrackComplete) {
          console.log('🎵 MPD Manager: Track finished naturally, triggering completion callback')
          this.stopProgressPolling()
          this.isPlaying = false
          // Only trigger if we still have a callback (not manually stopped)
          this.onTrackComplete()
        }
      } catch (error) {
        logger.error('MPD Manager: Error in progress polling', 'MPDManager', error)
      }
    }, 1000) // Poll every second
  }

  private stopProgressPolling(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval)
      this.progressInterval = null
    }
  }

  async playFile(filePath: string): Promise<boolean> {
    try {
      console.log('🎵 MPD Manager: playFile called with path:', filePath)
      logger.info('MPD Manager: Playing file: ' + filePath, 'MPDManager')
      
      // Stop any current playback
      console.log('🛑 MPD Manager: Stopping current playback...')
      await this.stop()
      
      // Add the file to MPD playlist and play it
      console.log('📁 MPD Manager: Loading file into MPD...')
      const success = await this.mpdLoadFile(filePath)
      
      if (success) {
        this.currentFile = filePath
        this.isPlaying = true
        this.playbackStartTime = Date.now()
        
        // Start progress polling
        this.startProgressPolling()
        
        console.log('✅ MPD Manager: Successfully started playback')
        logger.info('MPD Manager: Successfully started playback', 'MPDManager')
        return true
      } else {
        console.log('❌ MPD Manager: Failed to start playback')
        logger.error('MPD Manager: Failed to start playback', 'MPDManager')
        return false
      }
    } catch (error) {
      console.log('💥 MPD Manager: Error in playFile:', error)
      logger.error('MPD Manager: Error in playFile', 'MPDManager', error)
      return false
    }
  }

  private async mpdLoadFile(filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      console.log('🔍 MPD Manager: mpdLoadFile called with path:', filePath)
      
      // Extract the filename from the path to use for MPD search
      const fileName = filePath.split('/').pop()
      console.log('🔍 MPD Manager: Extracted filename:', fileName)
      
      if (!fileName) {
        console.log('💥 MPD Manager: Could not extract filename from path')
        resolve(false)
        return
      }
      
      // Execute commands separately instead of chaining them
      console.log('🚀 MPD Manager: Executing commands separately...')
      console.log('📁 MPD Manager: Current working directory:', process.cwd())
      
      // First, clear the playlist
      exec(`${this.mpcPath} clear`, { 
        cwd: '/Users/brianthornton/Desktop/Music',
        env: { ...process.env, MPD_MUSIC_DIR: '/Users/brianthornton/Desktop/Music' }
      }, (clearError, clearStdout, clearStderr) => {
        if (clearError) {
          console.log('💥 MPD Manager: Error clearing playlist:', clearError.message)
          resolve(false)
          return
        }
        
        console.log('✅ MPD Manager: Playlist cleared successfully')
        
        // Then, add the file using MPD search by filename
        const searchCommand = `${this.mpcPath} search filename "${fileName}"`
        console.log('🔍 MPD Manager: Searching for file:', searchCommand)
        
        exec(searchCommand, { 
          cwd: '/Users/brianthornton/Desktop/Music',
          env: { ...process.env, MPD_MUSIC_DIR: '/Users/brianthornton/Desktop/Music' }
        }, (searchError, searchStdout, searchStderr) => {
          if (searchError) {
            console.log('💥 MPD Manager: Error searching for file:', searchError.message)
            resolve(false)
            return
          }
          
          console.log('🔍 MPD Manager: Search results:', searchStdout)
          
          if (!searchStdout.trim()) {
            console.log('💥 MPD Manager: No search results found for filename:', fileName)
            resolve(false)
            return
          }
          
          // Get the first search result and add it
          const searchResult = searchStdout.trim().split('\n')[0]
          console.log('✅ MPD Manager: Found file in MPD database:', searchResult)
          
          // Add the found file to the playlist
          exec(`${this.mpcPath} add "${searchResult}"`, { 
            cwd: '/Users/brianthornton/Desktop/Music',
            env: { ...process.env, MPD_MUSIC_DIR: '/Users/brianthornton/Desktop/Music' }
          }, (addError, addStdout, addStderr) => {
            if (addError) {
              console.log('💥 MPD Manager: Error adding found file:', addError.message)
              resolve(false)
            } else {
              console.log('✅ MPD Manager: File added successfully via search')
              // Now play the file
              this.playAddedFile(resolve)
            }
          })
        })
      })
    })
  }

  // Helper method to play the file after it's been added
  private playAddedFile(resolve: (value: boolean) => void): void {
    exec(`${this.mpcPath} play`, { 
      cwd: '/Users/brianthornton/Desktop/Music',
      env: { ...process.env, MPD_MUSIC_DIR: '/Users/brianthornton/Desktop/Music' }
    }, (playError, playStdout, playStderr) => {
      if (playError) {
        console.log('💥 MPD Manager: Error playing file:', playError.message)
        logger.error('MPD Manager: Error playing file: ' + playError.message, 'MPDManager')
        resolve(false)
      } else {
        console.log('✅ MPD Manager: File playing successfully')
        console.log('📊 MPD Manager: Play command output:', playStdout)
        if (playStderr) {
          console.log('⚠️ MPD Manager: Play command stderr:', playStderr)
        }
        logger.info('MPD Manager: File playing successfully', 'MPDManager')
        resolve(true)
      }
    })
  }

  estimateDuration(filePath: string): number {
    // Try to get duration from MPD, fallback to file metadata
    try {
      // This is a rough estimate - MPD can provide more accurate info
      return 180 // Default 3 minutes
    } catch (error) {
      logger.error('MPD Manager: Error estimating duration', 'MPDManager', error)
      return 180
    }
  }

  getPlaybackProgress(): number {
    // For MPD, return the percentage (0-1) for the UI progress bar
    return this.latestProgressPercentage
  }

  async getMPDProgress(): Promise<number> {
    return new Promise((resolve) => {
      exec(`${this.mpcPath} status`, { cwd: '/Users/brianthornton/Desktop/Music' }, (error, stdout, stderr) => {
        if (error) {
          resolve(0)
        } else {
          try {
            const statusOutput = stdout.trim()
            // Parse the time format: "0:29/4:57 (9%)"
            const timeMatch = statusOutput.match(/(\d+):(\d+)\/(\d+):(\d+)/)
            if (timeMatch) {
              const currentMinutes = parseInt(timeMatch[1])
              const currentSeconds = parseInt(timeMatch[2])
              const totalSeconds = (currentMinutes * 60) + currentSeconds
              resolve(totalSeconds)
            } else {
              resolve(0)
            }
          } catch (parseError) {
            resolve(0)
          }
        }
      })
    })
  }

  async getMPDDuration(): Promise<number> {
    return new Promise((resolve) => {
      exec(`${this.mpcPath} status`, { cwd: '/Users/brianthornton/Desktop/Music' }, (error, stdout, stderr) => {
        if (error) {
          resolve(0)
        } else {
          try {
            const statusOutput = stdout.trim()
            // Parse the time format: "0:29/4:57 (9%)"
            const timeMatch = statusOutput.match(/(\d+):(\d+)\/(\d+):(\d+)/)
            if (timeMatch) {
              const totalMinutes = parseInt(timeMatch[3])
              const totalSeconds = parseInt(timeMatch[4])
              const totalDuration = (totalMinutes * 60) + totalSeconds
              resolve(totalDuration)
            } else {
              resolve(0)
            }
          } catch (parseError) {
            resolve(0)
          }
        }
      })
    })
  }

  // VLC-specific methods required by interface (not used in MPD mode)
  async getVLCProgress(): Promise<number> {
    return 0
  }

  async getVLCDuration(): Promise<number> {
    return 0
  }

  isTrackFinished(): boolean {
    if (!this.isPlaying) {
      return false
    }
    
    // Don't use our own timing - let MPD tell us when the track is actually finished
    // This prevents premature track completion callbacks
    return false
  }

  async stop(): Promise<boolean> {
    try {
      console.log('🛑 MPD Manager: stop() called')
      logger.info('MPD Manager: Stopping playback', 'MPDManager')
      
      // Don't clear the track completion callback here - it should persist across track changes
      // The callback is managed by the queue state, not by the MPD manager
      
      // Stop MPD playback
      console.log('🛑 MPD Manager: Executing mpc stop...')
      const success = await new Promise<boolean>((resolve) => {
        exec(`${this.mpcPath} stop`, { cwd: '/Users/brianthornton/Desktop/Music' }, (error, stdout, stderr) => {
          if (error) {
            console.log('💥 MPD Manager: Error stopping:', error.message)
            logger.error('MPD Manager: Error stopping: ' + error.message, 'MPDManager')
            resolve(false)
          } else {
            console.log('✅ MPD Manager: mpc stop successful')
            
            // Also clear the playlist to ensure complete stop
            console.log('🛑 MPD Manager: Clearing playlist...')
            exec(`${this.mpcPath} clear`, { cwd: '/Users/brianthornton/Desktop/Music' }, (clearError) => {
              if (clearError) {
                console.log('⚠️ MPD Manager: Error clearing playlist:', clearError.message)
              } else {
                console.log('✅ MPD Manager: Playlist cleared successfully')
              }
            })
            
            this.isPlaying = false
            this.currentFile = null
            this.playbackStartTime = null
            this.stopProgressPolling()
            logger.info('MPD Manager: Playback stopped successfully', 'MPDManager')
            resolve(true)
          }
        })
      })
      
      // BRUTE FORCE: Also kill any lingering VLC processes to prevent conflicts
      if (success) {
        try {
          if (this.platform === 'win32') {
            exec('taskkill /f /im vlc.exe', () => {})
          } else {
            exec('pkill -f vlc', () => {})
            exec('pkill -f "vlc --intf http"', () => {})
          }
        } catch (error) {
          // Ignore VLC cleanup errors
        }
      }
      
      return success
    } catch (error) {
      logger.error('MPD Manager: Error in stop', 'MPDManager', error)
      return false
    }
  }

  async forceStop(): Promise<boolean> {
    try {
      logger.info('MPD Manager: Force stopping all playback', 'MPDManager')
      
      // Stop MPD playback
      exec(`${this.mpcPath} stop`, { cwd: '/Users/brianthornton/Desktop/Music' }, () => {})
      
      // Clear MPD playlist
      exec(`${this.mpcPath} clear`, { cwd: '/Users/brianthornton/Desktop/Music' }, () => {})
      
      // BRUTE FORCE: Kill ALL audio processes including VLC
      try {
        if (this.platform === 'win32') {
          exec('taskkill /f /im mpc.exe', () => {})
          exec('taskkill /f /im vlc.exe', () => {})
        } else {
          exec('pkill -f mpc', () => {})
          exec('pkill -f vlc', () => {})
          exec('pkill -f "vlc --intf http"', () => {})
        }
      } catch (error) {
        // Ignore process killing errors
      }
      
      this.stopProgressPolling()
      this.isPlaying = false
      this.currentFile = null
      this.playbackStartTime = null
      
      logger.info('MPD Manager: Force stop completed', 'MPDManager')
      return true
    } catch (error) {
      logger.error('MPD Manager: Error in forceStop', 'MPDManager', error)
      return false
    }
  }

  async killAllAudioProcesses(): Promise<void> {
    try {
      logger.info('MPD Manager: Killing all audio processes', 'MPDManager')
      
      if (this.platform === 'win32') {
        exec('taskkill /f /im mpc.exe', () => {})
      } else {
        exec('pkill -f mpc', () => {})
      }
      
      this.stopProgressPolling()
      this.isPlaying = false
      this.currentFile = null
      this.playbackStartTime = null
      
      logger.info('MPD Manager: All audio processes killed', 'MPDManager')
    } catch (error) {
      logger.error('MPD Manager: Error killing audio processes', 'MPDManager', error)
    }
  }

  async pause(): Promise<boolean> {
    try {
      logger.info('MPD Manager: Pausing playback', 'MPDManager')
      
      return new Promise((resolve) => {
        exec(`${this.mpcPath} pause`, { cwd: '/Users/brianthornton/Desktop/Music' }, (error, stdout, stderr) => {
          if (error) {
            logger.error('MPD Manager: Error pausing: ' + error.message, 'MPDManager')
            resolve(false)
          } else {
            this.isPlaying = false
            logger.info('MPD Manager: Playback paused successfully', 'MPDManager')
            resolve(true)
          }
        })
      })
    } catch (error) {
      logger.error('MPD Manager: Error in pause', 'MPDManager', error)
      return false
    }
  }

  async resume(): Promise<boolean> {
    try {
      logger.info('MPD Manager: Resuming playback', 'MPDManager')
      
      return new Promise((resolve) => {
        exec(`${this.mpcPath} play`, { cwd: '/Users/brianthornton/Desktop/Music' }, (error, stdout, stderr) => {
          if (error) {
            logger.error('MPD Manager: Error resuming: ' + error.message, 'MPDManager')
            resolve(false)
          } else {
            this.isPlaying = true
            logger.info('MPD Manager: Playback resumed successfully', 'MPDManager')
            resolve(true)
          }
        })
      })
    } catch (error) {
      logger.error('MPD Manager: Error in resume', 'MPDManager', error)
      return false
    }
  }

  async seek(position: number): Promise<boolean> {
    try {
      logger.info('MPD Manager: Seeking to position: ' + position, 'MPDManager')
      
      // Position is a value between 0-1 (percentage of track)
      // We need to get the total duration and calculate the actual time
      const totalDuration = await this.getMPDDuration()
      if (totalDuration === 0) {
        logger.error('MPD Manager: Cannot seek - no duration available', 'MPDManager')
        return false
      }
      
      // Calculate the target time in seconds
      const targetSeconds = Math.floor(position * totalDuration)
      const minutes = Math.floor(targetSeconds / 60)
      const seconds = targetSeconds % 60
      const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`
      
      logger.info('MPD Manager: Seeking to time: ' + timeStr + ' (position: ' + position + ', duration: ' + totalDuration + 's)', 'MPDManager')
      
      return new Promise((resolve) => {
        exec(`${this.mpcPath} seek ${timeStr}`, { cwd: '/Users/brianthornton/Desktop/Music' }, (error, stdout, stderr) => {
          if (error) {
            logger.error('MPD Manager: Error seeking: ' + error.message, 'MPDManager')
            resolve(false)
          } else {
            logger.info('MPD Manager: Seek completed successfully', 'MPDManager')
            resolve(true)
          }
        })
      })
    } catch (error) {
      logger.error('MPD Manager: Error in seek', 'MPDManager', error)
      return false
    }
  }

  getStatus(): AudioStatus {
    return {
      isPlaying: this.isPlaying,
      currentFile: this.currentFile,
      hasProcess: this.isPlaying,
      platform: this.platform,
      wasPlayingBeforeKill: this.wasPlayingBeforeKill
    }
  }

  resetState(): void {
    this.isPlaying = false
    this.currentFile = null
    this.playbackStartTime = null
    this.wasPlayingBeforeKill = false
    this.stopProgressPolling()
  }

  async checkAndRestart(): Promise<boolean> {
    // MPD is more stable than VLC, so this is less critical
    return true
  }

  setCurrentFile(filePath: string): void {
    this.currentFile = filePath
  }

  getCurrentSong(): CurrentSong {
    return {
      file: this.currentFile,
      title: this.currentFile ? this.currentFile.split('/').pop() || null : null
    }
  }

  async setVolume(volume: number): Promise<number> {
    try {
      const clampedVolume = Math.max(0, Math.min(1, volume))
      this.volume = clampedVolume
      
      // Convert to percentage for MPD
      const percentage = Math.round(clampedVolume * 100)
      
      return new Promise((resolve) => {
        exec(`${this.mpcPath} volume ${percentage}`, { cwd: '/Users/brianthornton/Desktop/Music' }, (error, stdout, stderr) => {
          if (error) {
            logger.error('MPD Manager: Error setting volume: ' + error.message, 'MPDManager')
            resolve(this.volume)
          } else {
            logger.info('MPD Manager: Volume set to: ' + percentage + '%', 'MPDManager')
            resolve(this.volume)
          }
        })
      })
    } catch (error) {
      logger.error('MPD Manager: Error in setVolume', 'MPDManager', error)
      return this.volume
    }
  }

  private async applySystemVolume(): Promise<number> {
    try {
      if (this.platform === 'win32') {
        const percentage = Math.round(this.volume * 100)
        const command = `powershell -Command "(Get-AudioDevice -Playback).Volume = ${percentage}"`
        
        return new Promise((resolve) => {
          exec(command, (error, stdout, stderr) => {
            if (error) {
              logger.error('MPD Manager: Error setting system volume: ' + error.message, 'MPDManager')
              resolve(this.volume)
            } else {
              resolve(this.volume)
            }
          })
        })
      } else {
        const percentage = Math.round(this.volume * 100)
        const command = `osascript -e "set volume output volume ${percentage}"`
        
        return new Promise((resolve) => {
          exec(command, (error, stdout, stderr) => {
            if (error) {
              logger.error('MPD Manager: Error setting system volume: ' + error.message, 'MPDManager')
              resolve(this.volume)
            } else {
              resolve(this.volume)
            }
          })
        })
      }
    } catch (error) {
      logger.error('MPD Manager: Error in applySystemVolume', 'MPDManager', error)
      return this.volume
    }
  }

  private async querySystemVolume(): Promise<number> {
    try {
      let command: string
      
      if (this.platform === 'win32') {
        command = 'powershell -Command "[math]::Round((Get-AudioDevice -Playback).Volume / 100, 2)"'
      } else {
        command = 'osascript -e "output volume of (get volume settings)"'
      }
      
      return new Promise((resolve) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            logger.error('MPD Manager: Error querying system volume: ' + error.message, 'MPDManager')
            resolve(this.volume)
          } else {
            try {
              const systemVolume = parseFloat(stdout.trim())
              if (!isNaN(systemVolume)) {
                const normalizedVolume = this.platform === 'win32' ? systemVolume : systemVolume / 100
                this.volume = Math.max(0, Math.min(1, normalizedVolume))
                resolve(this.volume)
              } else {
                resolve(this.volume)
              }
            } catch (parseError) {
              resolve(this.volume)
            }
          }
        })
      })
    } catch (error) {
      logger.error('MPD Manager: Error in querySystemVolume', 'MPDManager', error)
      return this.volume
    }
  }

  getVolume(): number {
    return this.volume
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    
    if (this.muted) {
      this.muteSystemAudio()
    } else {
      this.unmuteSystemAudio()
    }
    
    return this.muted
  }

  muteSystemAudio(): void {
    try {
      if (this.platform === 'win32') {
        exec('powershell -Command "(Get-AudioDevice -Playback).Mute = $true"', () => {})
      } else {
        exec('osascript -e "set volume output muted true"', () => {})
      }
      logger.info('MPD Manager: System audio muted', 'MPDManager')
    } catch (error) {
      logger.error('MPD Manager: Error muting system audio', 'MPDManager', error)
    }
  }

  unmuteSystemAudio(): void {
    try {
      if (this.platform === 'win32') {
        exec('powershell -Command "(Get-AudioDevice -Playback).Mute = $false"', () => {})
      } else {
        exec('osascript -e "set volume output muted false"', () => {})
      }
      logger.info('MPD Manager: System audio unmuted', 'MPDManager')
    } catch (error) {
      logger.error('MPD Manager: Error unmuting system audio', 'MPDManager', error)
    }
  }

  isMuted(): boolean {
    return this.muted
  }

  // MPD-specific methods
  async getMPDStatus(): Promise<string> {
    return new Promise((resolve) => {
      exec(`${this.mpcPath} status`, { cwd: '/Users/brianthornton/Desktop/Music' }, (error, stdout, stderr) => {
        if (error) {
          resolve('stopped')
        } else {
          const status = stdout.trim().split('\n')[1] || 'stopped'
          resolve(status)
        }
      })
    })
  }

  async getMPDPlaylist(): Promise<string[]> {
    return new Promise((resolve) => {
      exec(`${this.mpcPath} playlist`, { cwd: '/Users/brianthornton/Desktop/Music' }, (error, stdout, stderr) => {
        if (error) {
          resolve([])
        } else {
          const lines = stdout.trim().split('\n')
          resolve(lines)
        }
      })
    })
  }
}

export default MPDManager
