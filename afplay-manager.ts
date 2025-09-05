import { exec, ChildProcess } from 'child_process'
import { AudioManagerInterface } from './types/audio'
import logger from './utils/logger'

export class AFPLAYManager implements AudioManagerInterface {
  private isPlaying: boolean = false
  private currentFile: string | null = null
  private playbackStartTime: number | null = null
  private volume: number = 1.0
  private muted: boolean = false
  private onTrackComplete: (() => void) | null = null
  private progressCallback: ((progress: number) => void) | null = null
  private currentProcess: ChildProcess | null = null
  private progressInterval: NodeJS.Timeout | null = null
  private latestProgressPercentage: number = 0
  private platform: string = process.platform
  private trackCompleted: boolean = false // Track if completion callback has been called
  private justSkipped: boolean = false // Track if we just skipped to this track
  private completionInProgress: boolean = false // Prevent multiple simultaneous completions

  constructor() {
    console.log('🎵 AFPLAY Manager: Initialized')
    logger.info('AFPLAY Manager: Initialized', 'AFPLAYManager')
  }

  async playFile(filePath: string): Promise<boolean> {
    try {
      console.log('🎵 AFPLAY Manager: playFile called with path:', filePath)
      logger.info('AFPLAY Manager: Playing file', 'AFPLAYManager', { filePath })
      
      // Stop any current playback first
      await this.stop()
      
      // Start AFPLAY with the file
      console.log('🚀 AFPLAY Manager: Starting AFPLAY...')
      const success = await this.startAFPLAY(filePath)
      
      if (success) {
        this.currentFile = filePath
        this.isPlaying = true
        this.playbackStartTime = Date.now()
        this.trackCompleted = false // Reset completion flag for new track
        this.completionInProgress = false // Reset completion lock for new track
        
        // Start progress polling
        this.startProgressPolling()
        
        // Add a startup delay to prevent immediate completion detection
        console.log('⏳ AFPLAY Manager: Adding startup delay to prevent race conditions')
        await new Promise(resolve => setTimeout(resolve, 2000)) // 2 second startup delay
        
        console.log('✅ AFPLAY Manager: Successfully started playback')
        logger.info('AFPLAY Manager: Successfully started playback', 'AFPLAYManager')
        return true
      } else {
        console.log('❌ AFPLAY Manager: Failed to start playback')
        logger.error('AFPLAY Manager: Failed to start playback', 'AFPLAYManager')
        return false
      }
    } catch (error) {
      console.log('💥 AFPLAY Manager: Error in playFile:', error)
      logger.error('AFPLAY Manager: Error in playFile', 'AFPLAYManager', error)
      return false
    }
  }

  private async startAFPLAY(filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      console.log('🔍 AFPLAY Manager: startAFPLAY called with path:', filePath)
      
      // Check if file exists and is accessible
      try {
        const fs = require('fs')
        if (!fs.existsSync(filePath)) {
          console.log('❌ AFPLAY Manager: File does not exist:', filePath)
          resolve(false)
          return
        }
        
        const stats = fs.statSync(filePath)
        console.log('📁 AFPLAY Manager: File stats - size:', stats.size, 'bytes, permissions:', stats.mode.toString(8))
        
        if (stats.size === 0) {
          console.log('❌ AFPLAY Manager: File is empty')
          resolve(false)
          return
        }
      } catch (error) {
        console.log('❌ AFPLAY Manager: Error checking file:', (error as Error).message)
        resolve(false)
        return
      }
      
      // Use afplay command which is built into macOS
      // Escape the file path properly to handle spaces and special characters
      const escapedPath = filePath.replace(/"/g, '\\"')
      
      // Check file extension to see if it's supported
      const fileExtension = filePath.toLowerCase().split('.').pop()
      console.log('🎵 AFPLAY Manager: File extension:', fileExtension)
      
      // AFPLAY supports: .aiff, .wav, .mp3, .m4a, .aac, .caf, .snd, .au, .sd2, .pcm
      const supportedFormats = ['aiff', 'wav', 'mp3', 'm4a', 'aac', 'caf', 'snd', 'au', 'sd2', 'pcm']
      if (!supportedFormats.includes(fileExtension || '')) {
        console.log('❌ AFPLAY Manager: Unsupported file format:', fileExtension)
        resolve(false)
        return
      }
      
      const afplayCommand = `afplay "${escapedPath}"`
      console.log('🚀 AFPLAY Manager: Running command:', afplayCommand)
      
      this.currentProcess = exec(afplayCommand, (error, stdout, stderr) => {
        if (error) {
          console.log('💥 AFPLAY Manager: Error playing file:', error.message)
          console.log('💥 AFPLAY Manager: Error code:', error.code)
          console.log('💥 AFPLAY Manager: Error signal:', error.signal)
          if (stderr) {
            console.log('💥 AFPLAY Manager: stderr:', stderr)
          }
          if (stdout) {
            console.log('💥 AFPLAY Manager: stdout:', stdout)
          }
          logger.error('AFPLAY Manager: Error playing file: ' + error.message, 'AFPLAYManager', {
            code: error.code,
            signal: error.signal,
            stderr: stderr,
            stdout: stdout,
            command: afplayCommand
          })
          // Don't resolve here as this callback only fires when playback completes
        } else {
          console.log('✅ AFPLAY Manager: File completed playing via exec callback')
          if (stdout) {
            console.log('✅ AFPLAY Manager: stdout:', stdout)
          }
          if (stderr) {
            console.log('✅ AFPLAY Manager: stderr:', stderr)
          }
          logger.info('AFPLAY Manager: File completed playing', 'AFPLAYManager')
          
          // Track completed naturally - call the completion callback
          this.handleTrackCompletion()
        }
      })
      
      // Set up process exit handling
      if (this.currentProcess) {
        this.currentProcess.on('exit', (code) => {
          console.log('🔄 AFPLAY Manager: Process exited with code:', code)
          console.log('🔄 AFPLAY Manager: Process stdout:', this.currentProcess?.stdout?.read())
          console.log('🔄 AFPLAY Manager: Process stderr:', this.currentProcess?.stderr?.read())
          
          // Only call completion callback if exec callback hasn't already fired
          if (!this.trackCompleted) {
            console.log('🔄 AFPLAY Manager: Process exit triggered completion (exec callback did not fire)')
            this.handleTrackCompletion()
          } else {
            console.log('🔄 AFPLAY Manager: Process exit ignored - completion already handled by exec callback')
          }
        })
        
        this.currentProcess.on('error', (error) => {
          console.log('💥 AFPLAY Manager: Process error:', error.message)
          logger.error('AFPLAY Manager: Process error: ' + error.message, 'AFPLAYManager')
        })
      }
      
      // Check if the process started successfully
      setTimeout(() => {
        if (this.currentProcess && !this.currentProcess.killed) {
          console.log('✅ AFPLAY Manager: Process started successfully, resolving true')
          
          // DISABLED: Completion timeout fallback
          // This was causing tracks to race through the queue
          // Only rely on actual process completion now
          
          resolve(true)
        } else {
          console.log('❌ AFPLAY Manager: Process failed to start, resolving false')
          resolve(false)
        }
      }, 200) // Give it a bit more time to start
    })
  }

  async stop(): Promise<boolean> {
    try {
      console.log('🛑 AFPLAY Manager: stop called')
      logger.info('AFPLAY Manager: Stop called', 'AFPLAYManager')
      
      // Kill the current process if we have a reference
      if (this.currentProcess) {
        console.log('🔪 AFPLAY Manager: Killing current process...')
        this.currentProcess.kill('SIGTERM')
        
        // Force kill if it doesn't respond
        setTimeout(() => {
          if (this.currentProcess && !this.currentProcess.killed) {
            console.log('💥 AFPLAY Manager: Force killing process...')
            this.currentProcess.kill('SIGKILL')
          }
        }, 1000)
      }
      
      // BRUTE FORCE: Kill ALL afplay processes to ensure nothing is playing
      console.log('💥 AFPLAY Manager: Force killing all afplay processes...')
      exec('pkill -f afplay', (error) => {
        if (error) {
          console.log('⚠️ AFPLAY Manager: No afplay processes to kill')
        } else {
          console.log('✅ AFPLAY Manager: All afplay processes killed')
        }
      })
      
      // Wait a moment for processes to fully terminate
      await new Promise(resolve => setTimeout(resolve, 500))
      
      this.isPlaying = false
      this.currentFile = null
      this.playbackStartTime = null
      this.currentProcess = null
      this.trackCompleted = false
      
      // Stop progress polling
      this.stopProgressPolling()
      
      console.log('✅ AFPLAY Manager: Successfully stopped')
      logger.info('AFPLAY Manager: Successfully stopped', 'AFPLAYManager')
      return true
    } catch (error) {
      console.log('💥 AFPLAY Manager: Error in stop:', error)
      logger.error('AFPLAY Manager: Error in stop', 'AFPLAYManager', error)
      return false
    }
  }

  async pause(): Promise<boolean> {
    try {
      logger.info('AFPLAY Manager: Pausing playback', 'AFPLAYManager')
      
      // For AFPLAY, we'll just kill the process to pause
      if (this.currentProcess) {
        this.currentProcess.kill('SIGTERM')
      }
      
      this.isPlaying = false
      logger.info('AFPLAY Manager: Playback paused successfully', 'AFPLAYManager')
      return true
    } catch (error) {
      logger.error('AFPLAY Manager: Error in pause', 'AFPLAYManager', error)
      return false
    }
  }

  async resume(): Promise<boolean> {
    try {
      logger.info('AFPLAY Manager: Resuming playback', 'AFPLAYManager')
      
      if (this.currentFile) {
        const success = await this.playFile(this.currentFile)
        if (success) {
          logger.info('AFPLAY Manager: Playback resumed successfully', 'AFPLAYManager')
          return true
        } else {
          logger.error('AFPLAY Manager: Failed to resume playback', 'AFPLAYManager')
          return false
        }
      } else {
        logger.error('AFPLAY Manager: No current file to resume', 'AFPLAYManager')
        return false
      }
    } catch (error) {
      logger.error('AFPLAY Manager: Error in resume', 'AFPLAYManager', error)
      return false
    }
  }

  // AFPLAY doesn't support seeking, so this method always returns false
  async seek(position: number): Promise<boolean> {
    console.log('⚠️ AFPLAY Manager: Seek not supported by afplay')
    logger.warn('AFPLAY Manager: Seek not supported by afplay', 'AFPLAYManager')
    return false
  }

  async setVolume(volume: number): Promise<number> {
    try {
      logger.info('AFPLAY Manager: Setting volume', 'AFPLAYManager', { volume })
      
      // Clamp volume between 0 and 1
      const clampedVolume = Math.max(0, Math.min(1, volume))
      this.volume = clampedVolume
      
      // Convert to percentage for system volume
      const percentage = Math.round(clampedVolume * 100)
      
      if (this.platform === 'darwin') {
        // Use osascript to set system volume on macOS
        exec(`osascript -e "set volume output volume ${percentage}"`, (error) => {
          if (error) {
            console.log('⚠️ AFPLAY Manager: Error setting system volume:', error.message)
            logger.error('AFPLAY Manager: Error setting system volume: ' + error.message, 'AFPLAYManager')
          } else {
            console.log('✅ AFPLAY Manager: System volume set to:', percentage, '%')
            logger.info('AFPLAY Manager: System volume set to ' + percentage + '%', 'AFPLAYManager')
          }
        })
      }
      
      return this.volume
    } catch (error) {
      logger.error('AFPLAY Manager: Error setting volume', 'AFPLAYManager', error)
      return this.volume
    }
  }

  getVolume(): number {
    return this.volume
  }

  isMuted(): boolean {
    return this.muted
  }

  async toggleMute(): Promise<boolean> {
    try {
      this.muted = !this.muted
      
      if (this.muted) {
        this.muteSystemAudio()
      } else {
        this.unmuteSystemAudio()
      }
      
      logger.info('AFPLAY Manager: Mute toggled to: ' + this.muted, 'AFPLAYManager')
      return this.muted
    } catch (error) {
      logger.error('AFPLAY Manager: Error toggling mute', 'AFPLAYManager', error)
      return false
    }
  }

  muteSystemAudio(): void {
    try {
      if (this.platform === 'darwin') {
        exec('osascript -e "set volume output volume 0"', (error) => {
          if (error) {
            console.log('⚠️ AFPLAY Manager: Error muting system audio:', error.message)
          } else {
            console.log('✅ AFPLAY Manager: System audio muted')
          }
        })
      }
      logger.info('AFPLAY Manager: System audio muted', 'AFPLAYManager')
    } catch (error) {
      logger.error('AFPLAY Manager: Error muting system audio', 'AFPLAYManager', error)
    }
  }

  unmuteSystemAudio(): void {
    try {
      if (this.platform === 'darwin') {
        // Restore to previous volume level
        const percentage = Math.round(this.volume * 100)
        exec(`osascript -e "set volume output volume ${percentage}"`, (error) => {
          if (error) {
            console.log('⚠️ AFPLAY Manager: Error unmuting system audio:', error.message)
          } else {
            console.log('✅ AFPLAY Manager: System audio unmuted, volume restored to:', percentage, '%')
          }
        })
      }
      logger.info('AFPLAY Manager: System audio unmuted', 'AFPLAYManager')
    } catch (error) {
      logger.error('AFPLAY Manager: Error unmuting system audio', 'AFPLAYManager', error)
    }
  }

  // Force reset the AFPLAY manager state to match queue state
  forceResetState(): void {
    console.log('🎵 AFPLAY Manager: Force resetting state')
    this.isPlaying = false
    this.currentFile = null
    this.playbackStartTime = null
    this.trackCompleted = false
    this.completionInProgress = false
    this.justSkipped = false
    this.latestProgressPercentage = 0
  }

  async forceStop(): Promise<boolean> {
    try {
      logger.info('AFPLAY Manager: Force stopping all playback', 'AFPLAYManager')
      
      // Kill all AFPLAY processes
      if (this.platform === 'darwin') {
        exec('pkill -f afplay', () => {})
      }
      
      this.stopProgressPolling()
      this.isPlaying = false
      this.currentFile = null
      this.playbackStartTime = null
      this.trackCompleted = false
      
      if (this.currentProcess) {
        this.currentProcess.kill('SIGKILL')
        this.currentProcess = null
      }
      
      logger.info('AFPLAY Manager: Force stop completed', 'AFPLAYManager')
      return true
    } catch (error) {
      logger.error('AFPLAY Manager: Error in forceStop', 'AFPLAYManager', error)
      return false
    }
  }

  async killAllAudioProcesses(): Promise<void> {
    try {
      logger.info('AFPLAY Manager: Killing all audio processes', 'AFPLAYManager')
      
      if (this.platform === 'darwin') {
        exec('pkill -f afplay', () => {})
      }
      
      logger.info('AFPLAY Manager: All audio processes killed', 'AFPLAYManager')
    } catch (error) {
      logger.error('AFPLAY Manager: Error killing audio processes', 'AFPLAYManager', error)
    }
  }

  getStatus(): { isPlaying: boolean; currentFile: string | null; hasProcess: boolean; platform: string; wasPlayingBeforeKill: boolean } {
    try {
      // Check if we actually have a running AFPLAY process
      const hasRunningProcess = Boolean(this.currentProcess && !this.currentProcess.killed)
      
      // If we have a running process, we should be playing
      const actualIsPlaying = hasRunningProcess && this.currentFile !== null
      
      console.log('🔍 AFPLAY Manager: getStatus called - currentProcess:', !!this.currentProcess, 'killed:', this.currentProcess?.killed, 'currentFile:', !!this.currentFile, 'actualIsPlaying:', actualIsPlaying)
      
      return {
        isPlaying: actualIsPlaying,
        currentFile: this.currentFile,
        hasProcess: hasRunningProcess,
        platform: this.platform,
        wasPlayingBeforeKill: false
      }
    } catch (error) {
      console.error('AFPLAY Manager: Error in getStatus:', error)
      // Return safe fallback values
      return {
        isPlaying: false,
        currentFile: null,
        hasProcess: false,
        platform: this.platform,
        wasPlayingBeforeKill: false
      }
    }
  }

  getPlaybackProgress(): number {
    if (!this.isPlaying || !this.playbackStartTime || !this.currentFile) {
      return 0
    }
    
    try {
      // Calculate elapsed time since playback started
      const elapsed = (Date.now() - this.playbackStartTime) / 1000
      
      // Get estimated duration
      const duration = this.estimateDuration(this.currentFile)
      
      if (duration <= 0) {
        return 0
      }
      
      // Calculate progress as a percentage (0-1)
      const progress = Math.min(elapsed / duration, 1)
      
      // Update latest progress
      this.latestProgressPercentage = progress
      
      return progress
    } catch (error) {
      console.log('⚠️ AFPLAY Manager: Error calculating progress:', error)
      return 0
    }
  }

  getCurrentSong(): { file: string | null; title: string | null } {
    if (this.currentFile) {
      return { file: this.currentFile, title: this.currentFile.split('/').pop() || null }
    }
    return { file: null, title: null }
  }

  // Legacy method for compatibility
  getCurrentSongPath(): string | null {
    return this.currentFile
  }

  resetState(): void {
    this.isPlaying = false
    this.currentFile = null
    this.playbackStartTime = null
    this.currentProcess = null
    this.stopProgressPolling()
  }

  async checkAndRestart(): Promise<boolean> {
    try {
      if (this.currentFile && !this.isPlaying) {
        return await this.playFile(this.currentFile)
      }
      return this.isPlaying
    } catch (error) {
      logger.error('AFPLAY Manager: Error in checkAndRestart', 'AFPLAYManager', error)
      return false
    }
  }

  setCurrentFile(filePath: string): void {
    this.currentFile = filePath
  }

  isTrackFinished(): boolean {
    return !this.isPlaying && this.currentFile !== null
  }

  estimateDuration(filePath: string): number {
    // This is a rough estimate - in a real implementation you might want to
    // use a library like ffprobe to get actual duration
    try {
      // Try to get file size and estimate duration based on that
      const fs = require('fs')
      const stats = fs.statSync(filePath)
      const sizeInMB = stats.size / (1024 * 1024)
      
      // Rough estimate: assume 1MB per minute for audio files
      // This is a very rough approximation but better than a fixed value
      const estimatedMinutes = Math.max(1, Math.min(20, sizeInMB))
      const estimatedSeconds = estimatedMinutes * 60
      
      return estimatedSeconds
    } catch (error) {
      // Default to 5 minutes if we can't estimate (more conservative)
      return 300
    }
  }

  clearCallbackForStop(): void {
    // Clear the track completion callback to prevent it from firing during stop operations
    this.onTrackComplete = null
    this.trackCompleted = false
    console.log('🔄 AFPLAY Manager: Cleared track completion callback for stop')
  }

  getLatestProgress(): number {
    return this.latestProgressPercentage
  }

  async getVLCProgress(): Promise<number> {
    // Not applicable for AFPLAY, return current progress
    return this.getPlaybackProgress()
  }

  async getVLCDuration(): Promise<number> {
    // Not applicable for AFPLAY, return estimated duration
    return this.estimateDuration(this.currentFile || '')
  }

  setTrackCompleteCallback(callback: () => void): void {
    this.onTrackComplete = callback
  }

  clearTrackCompleteCallback(): void {
    this.onTrackComplete = null
  }

  setProgressCallback(callback: (progress: number) => void): void {
    this.progressCallback = callback
  }

  markAsSkipped(): void {
    this.justSkipped = true
    console.log('🔄 AFPLAY Manager: Track marked as skipped - extra completion protection enabled')
  }

  private startProgressPolling(): void {
    this.stopProgressPolling()
    
    // Use arrow function to preserve 'this' context
    this.progressInterval = setInterval(() => {
      if (this.isPlaying && this.playbackStartTime && this.currentFile) {
        const elapsed = (Date.now() - this.playbackStartTime) / 1000 // seconds
        const duration = this.estimateDuration(this.currentFile)
        
        if (duration > 0) {
          // Calculate progress based on elapsed time
          const progress = Math.min(elapsed / duration, 1)
          this.latestProgressPercentage = progress
          
          if (this.progressCallback) {
            this.progressCallback(progress)
          }
          
          // DISABLED: Aggressive fallback completion detection
          // This was causing tracks to race through the queue
          // Only rely on actual process completion now
        }
      }
    }, 1000) // Update every second
  }

  private stopProgressPolling(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval)
      this.progressInterval = null
    }
  }

  private handleTrackCompletion(): void {
    // Prevent multiple simultaneous completions
    if (this.completionInProgress) {
      console.log('⚠️ AFPLAY Manager: Completion already in progress, ignoring duplicate call')
      return
    }
    
    this.completionInProgress = true
    console.log('🔄 AFPLAY Manager: handleTrackCompletion called')
    console.log('🔄 AFPLAY Manager: onTrackComplete callback exists:', !!this.onTrackComplete)
    console.log('🔄 AFPLAY Manager: trackCompleted flag:', this.trackCompleted)
    console.log('🔄 AFPLAY Manager: currentFile:', this.currentFile)
    console.log('🔄 AFPLAY Manager: isPlaying:', this.isPlaying)
    
    // Only call completion callback if we haven't already called it
    if (this.onTrackComplete && !this.trackCompleted) {
      console.log('🔄 AFPLAY Manager: Calling track completion callback')
      this.trackCompleted = true
      this.onTrackComplete()
      console.log('🔄 AFPLAY Manager: Track completion callback executed')
    } else {
      console.log('⚠️ AFPLAY Manager: Track completion callback already called or not set')
      if (!this.onTrackComplete) {
        console.log('⚠️ AFPLAY Manager: No completion callback set - this is the problem!')
      }
      if (this.trackCompleted) {
        console.log('⚠️ AFPLAY Manager: Track already marked as completed')
      }
    }
    
    // Update state
    this.isPlaying = false
    this.stopProgressPolling()
    this.justSkipped = false // Reset the skipped flag for the next track
    console.log('🔄 AFPLAY Manager: State updated, isPlaying:', this.isPlaying, 'justSkipped reset to false')
    
    // Reset completion lock after a delay to allow state to settle
    setTimeout(() => {
      this.completionInProgress = false
      console.log('🔄 AFPLAY Manager: Completion lock reset')
    }, 1000)
  }

  async resetVLCState(): Promise<void> {
    // AFPLAY doesn't need VLC state reset, but we implement it for interface compatibility
    console.log('🎵 AFPLAY Manager: resetVLCState called (no-op for AFPLAY)')
  }
}
