import player from 'play-sound'
import { exec, type ChildProcess } from 'child_process'
import fs from 'fs'
// Temporarily disable logger to fix playback
// import logger from './utils/serverLogger'
import type { AudioStatus, CurrentSong, AudioManagerInterface } from './types/audio'

const audioPlayer = player({
  // Windows-specific configuration
  players: process.platform === 'win32' ? ['mplayer', 'mpg123', 'mpg321'] : undefined
})

class AudioManager implements AudioManagerInterface {
  private currentProcess: ChildProcess | null = null
  private isPlaying = false
  private currentFile: string | null = null
  private readonly platform: string
  private volume = 1.0
  private muted = false
  private playbackStartTime: number | null = null
  private estimatedDuration = 0 // in seconds
  private wasPlayingBeforeKill = false // Track if we were playing before process was killed

  constructor() {
    this.platform = process.platform
  }

  async playFile(filePath: string): Promise<boolean> {
    try {
      console.log('Audio Manager: Playing file:', filePath)
      
      // If we're already playing this file, don't restart
      if (this.currentFile === filePath && this.isPlaying && this.currentProcess) {
        console.log('Audio Manager: Already playing this file, skipping restart')
        return true
      }
      
      // Stop any currently playing audio
      await this.stop()
      
      // Estimate duration based on file size (rough approximation)
      this.estimatedDuration = this.estimateDuration(filePath)
      this.playbackStartTime = Date.now()
      
      console.log('Audio Manager: Starting playback with play-sound')
      
      // Start playing the new file
      this.currentProcess = audioPlayer.play(filePath, (err: Error | undefined) => {
        if (err) {
          console.error('Audio Manager: Error playing file:', err)
          this.isPlaying = false
          this.currentFile = null
          this.playbackStartTime = null
          this.wasPlayingBeforeKill = false
        } else {
          console.log('Audio Manager: Finished playing:', filePath)
          this.isPlaying = false
          this.currentFile = null
          this.playbackStartTime = null
          this.wasPlayingBeforeKill = false
        }
      })
      
      this.isPlaying = true
      this.currentFile = filePath
      this.wasPlayingBeforeKill = false // Reset flag when starting new playback
      
      console.log('Audio Manager: Now playing:', filePath, 'isPlaying:', this.isPlaying, 'currentProcess:', !!this.currentProcess)
      
      // Add a small delay to ensure the audio process has started
      await new Promise(resolve => setTimeout(resolve, 100))
      
      console.log('Audio Manager: After delay - isPlaying:', this.isPlaying, 'currentProcess:', !!this.currentProcess)
      return true
    } catch (error) {
      console.error('Audio Manager: Error playing file:', error)
      this.isPlaying = false
      this.currentFile = null
      this.playbackStartTime = null
      this.wasPlayingBeforeKill = false
      return false
    }
  }

  estimateDuration(filePath: string): number {
    // Rough estimation based on file size
    // This is a very basic approximation - in a real app you'd use metadata
    try {
      const stats = fs.statSync(filePath)
      const sizeInMB = stats.size / (1024 * 1024)
      // Assume roughly 1MB per minute for MP3
      return Math.max(30, Math.min(600, sizeInMB * 60)) // Between 30 seconds and 10 minutes
    } catch (error) {
      return 180 // Default 3 minutes
    }
  }

  getPlaybackProgress(): number {
    if (!this.isPlaying || !this.playbackStartTime || !this.estimatedDuration) {
      return 0
    }
    
    const elapsed = (Date.now() - this.playbackStartTime) / 1000
    const progress = Math.min(1, elapsed / this.estimatedDuration)
    return progress
  }

  isTrackFinished(): boolean {
    if (!this.isPlaying || !this.playbackStartTime || !this.estimatedDuration) {
      return false
    }
    
    const elapsed = (Date.now() - this.playbackStartTime) / 1000
    return elapsed >= this.estimatedDuration
  }

  async stop(): Promise<boolean> {
    try {
      console.log('Audio Manager: Stopping all audio playback...')
      
      // Kill the current process if it exists
      if (this.currentProcess) {
        try {
          if (this.platform === 'win32') {
            this.currentProcess.kill('SIGTERM')
          } else {
            this.currentProcess.kill()
          }
        } catch (e) {
          console.log('Audio Manager: Error killing current process:', (e as Error).message)
        }
        this.currentProcess = null
      }
      
      // Kill all audio processes aggressively
      await this.killAllAudioProcesses()
      
      this.isPlaying = false
      this.currentFile = null
      this.playbackStartTime = null
      console.log('Audio Manager: Playback stopped')
      return true
    } catch (error) {
      console.error('Audio Manager: Error stopping playback:', error)
      return false
    }
  }

  async killAllAudioProcesses(): Promise<void> {
    return new Promise((resolve) => {
      let command: string
      
      if (this.platform === 'win32') {
        // Windows: Kill audio processes
        command = 'taskkill /f /im mplayer.exe /im mpg123.exe /im mpg321.exe /im afplay.exe 2>nul || echo "No audio processes found"'
      } else {
        // macOS/Linux: Kill audio processes
        command = 'pkill -f afplay; pkill -f mpg123; pkill -f mpg321; pkill -f mplayer; pkill -f "play-sound" || echo "No audio processes found"'
      }
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log('Audio Manager: Error killing audio processes:', error.message)
        } else {
          console.log('Audio Manager: Killed audio processes:', stdout)
        }
        resolve()
      })
    })
  }

  async pause(): Promise<boolean> {
    try {
      if (this.currentProcess) {
        // Windows-compatible pause
        if (this.platform === 'win32') {
          this.currentProcess.kill('SIGSTOP')
        } else {
          this.currentProcess.kill('SIGSTOP')
        }
        this.isPlaying = false
        console.log('Audio Manager: Playback paused')
      }
      return true
    } catch (error) {
      console.error('Audio Manager: Error pausing playback:', error)
      return false
    }
  }

  async resume(): Promise<boolean> {
    try {
      if (this.currentProcess) {
        // Windows-compatible resume
        if (this.platform === 'win32') {
          this.currentProcess.kill('SIGCONT')
        } else {
          this.currentProcess.kill('SIGCONT')
        }
        this.isPlaying = true
        console.log('Audio Manager: Playback resumed')
      }
      return true
    } catch (error) {
      console.error('Audio Manager: Error resuming playback:', error)
      return false
    }
  }

  getStatus(): AudioStatus {
    // Check if our process is still alive
    if (this.currentProcess && this.isPlaying) {
      try {
        // Try to check if process is still running (this might throw if process is dead)
        if (this.currentProcess.killed !== undefined && this.currentProcess.killed) {
          console.log('Audio Manager: Detected killed process, resetting state')
          this.wasPlayingBeforeKill = true // Mark that we were playing before kill
          this.resetState()
        }
      } catch (error) {
        console.log('Audio Manager: Process check failed, assuming killed:', (error as Error).message)
        this.wasPlayingBeforeKill = true // Mark that we were playing before kill
        this.resetState()
      }
    }
    
    return {
      isPlaying: this.isPlaying,
      currentFile: this.currentFile,
      hasProcess: !!this.currentProcess,
      platform: this.platform,
      wasPlayingBeforeKill: this.wasPlayingBeforeKill
    }
  }

  // Reset state when process is killed externally (e.g., during recompile)
  resetState(): void {
    console.log('Audio Manager: Resetting state due to external process kill')
    this.currentProcess = null
    this.isPlaying = false
    // Don't clear currentFile - we want to preserve what should be playing
    this.playbackStartTime = null
    // Don't clear wasPlayingBeforeKill - we want to preserve this flag for restart logic
  }

  // Check if we need to restart playback after a process kill
  async checkAndRestart(): Promise<boolean> {
    if (this.currentFile && !this.isPlaying && !this.currentProcess) {
      console.log('Audio Manager: Detected killed process, restarting playback for:', this.currentFile)
      return await this.playFile(this.currentFile)
    }
    return false
  }

  // Set current file without starting playback (for state restoration)
  setCurrentFile(filePath: string): void {
    this.currentFile = filePath
    console.log('Audio Manager: Set current file to:', filePath)
  }

  getCurrentSong(): CurrentSong {
    return {
      file: this.currentFile,
      title: this.currentFile ? this.currentFile.split(/[\/\\]/).pop() || null : null
    }
  }

  setVolume(volume: number): boolean {
    this.volume = Math.max(0, Math.min(1, volume))
    this.muted = this.volume === 0
    console.log('Audio Manager: Volume set to:', this.volume)
    
    // Apply volume to system audio
    this.applySystemVolume()
    return true
  }

  applySystemVolume(): void {
    try {
      let command: string
      const volumePercent = Math.round(this.volume * 100)
      
      if (this.platform === 'win32') {
        // Windows: Use PowerShell to set system volume
        command = `powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]${volumePercent})"`
      } else {
        // macOS: Use osascript to set system volume
        command = `osascript -e 'set volume output volume ${volumePercent}'`
      }
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log('Audio Manager: Error setting system volume:', error.message)
        } else {
          console.log('Audio Manager: System volume set to:', `${volumePercent  }%`)
        }
      })
    } catch (error) {
      console.error('Audio Manager: Error applying system volume:', error)
    }
  }

  getVolume(): number {
    return this.volume
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    console.log('Audio Manager: Mute toggled to:', this.muted)
    
    // Apply mute state to system
    if (this.muted) {
      this.muteSystemAudio()
    } else {
      this.unmuteSystemAudio()
    }
    
    return true
  }

  muteSystemAudio(): void {
    try {
      let command: string
      
      if (this.platform === 'win32') {
        // Windows: Mute system audio
        command = 'powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"'
      } else {
        // macOS: Mute system audio
        command = 'osascript -e "set volume output muted true"'
      }
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log('Audio Manager: Error muting system audio:', error.message)
        } else {
          console.log('Audio Manager: System audio muted')
        }
      })
    } catch (error) {
      console.error('Audio Manager: Error muting system audio:', error)
    }
  }

  unmuteSystemAudio(): void {
    try {
      let command: string
      
      if (this.platform === 'win32') {
        // Windows: Unmute system audio
        command = 'powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"'
      } else {
        // macOS: Unmute system audio
        command = 'osascript -e "set volume output muted false"'
      }
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log('Audio Manager: Error unmuting system audio:', error.message)
        } else {
          console.log('Audio Manager: System audio unmuted')
        }
      })
    } catch (error) {
      console.error('Audio Manager: Error unmuting system audio:', error)
    }
  }

  isMuted(): boolean {
    return this.muted
  }
}

export default AudioManager 