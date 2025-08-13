import { exec, type ChildProcess } from 'child_process'
import fs from 'fs'
import logger from './utils/serverLogger'
import type { AudioStatus, CurrentSong, AudioManagerInterface } from './types/audio'

class AudioManager implements AudioManagerInterface {
  private vlcProcess: ChildProcess | null = null
  private vlcPort: number = 8080
  private vlcPassword: string = 'jukebox'
  private vlcProgressInterval: NodeJS.Timeout | null = null
  private vlcProgressCallback: ((progress: number) => void) | null = null
  private latestProgress: number = 0
  private onTrackComplete: (() => void) | null = null
  private currentFile: string | null = null
  private isPlaying = false
  private volume = 1.0
  private muted = false
  private platform: string = process.platform
  private wasPlayingBeforeKill = false
  private completionCheckInterval: NodeJS.Timeout | null = null

  constructor() {
    console.log('🎬 VLC Audio Manager: Initialized for platform:', this.platform)
    this.startVLC()
  }

  private async startVLC(): Promise<void> {
    if (this.vlcProcess) {
      console.log('🎬 VLC Audio Manager: VLC already running')
      return
    }

    const platform = this.platform
    let command: string

    if (platform === 'win32') {
      command = `vlc --intf http --http-port ${this.vlcPort} --http-password ${this.vlcPassword} --no-video --no-qt-error-dialogs --no-qt-system-tray`
    } else {
      command = `vlc --intf http --http-port ${this.vlcPort} --http-password ${this.vlcPassword} --no-video --quiet`
    }

    console.log('🎬 VLC Audio Manager: Starting VLC with command:', command)

    this.vlcProcess = exec(command, (error) => {
      if (error) {
        console.error('🎬 VLC Audio Manager: VLC process error:', error)
      }
    })

    this.vlcProcess.on('exit', (code) => {
      console.log('🎬 VLC Audio Manager: VLC process exited with code:', code)
      this.vlcProcess = null
    })

    // Wait for VLC to start and then start completion checking
    setTimeout(() => {
      this.startCompletionChecking()
    }, 3000)
  }

  private async startCompletionChecking(): Promise<void> {
    if (this.completionCheckInterval) {
      clearInterval(this.completionCheckInterval)
    }

    console.log('🎬 VLC Audio Manager: Starting completion checking...')
    
    this.completionCheckInterval = setInterval(async () => {
      try {
        if (this.isPlaying && this.onTrackComplete) {
          const status = await this.getVLCStatus()
          if (status) {
            console.log('🎬 VLC Audio Manager: Checking completion - status:', status)
            // Check if track has completed (either stopped or reached the end)
            if (status.state === 'stopped' || 
                (status.totalLength > 0 && status.currentTime >= status.totalLength - 2)) {
              console.log('🎬 VLC Audio Manager: Track completion detected!')
              console.log('🎬 VLC Audio Manager: Final status:', status)
              this.isPlaying = false
              this.currentFile = null
              
              // Call the completion callback
              if (this.onTrackComplete) {
                console.log('🎬 VLC Audio Manager: Calling track completion callback')
                this.onTrackComplete()
              } else {
                console.log('🎬 VLC Audio Manager: No completion callback set!')
              }
            }
          } else {
            console.log('🎬 VLC Audio Manager: Could not get VLC status')
          }
        } else {
          if (!this.isPlaying) {
            console.log('🎬 VLC Audio Manager: Not playing, skipping completion check')
          }
          if (!this.onTrackComplete) {
            console.log('🎬 VLC Audio Manager: No completion callback set, skipping completion check')
          }
        }
      } catch (error) {
        console.error('🎬 VLC Audio Manager: Error in completion checking:', error)
      }
    }, 1000)

    console.log('🎬 VLC Audio Manager: Completion checking started')
  }

  private async getVLCStatus(): Promise<any> {
    try {
      const statusUrl = `http://localhost:${this.vlcPort}/requests/status.xml`
      const response = await fetch(statusUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })

      if (!response.ok) {
        return null
      }

      const statusText = await response.text()
      const timeMatch = statusText.match(/<time>(\d+)<\/time>/)
      const lengthMatch = statusText.match(/<length>(\d+)<\/length>/)
      const stateMatch = statusText.match(/<state>(\w+)<\/state>/)

      if (timeMatch && lengthMatch && stateMatch) {
        const currentTime = parseInt(timeMatch[1])
        const totalLength = parseInt(lengthMatch[1])
        const state = stateMatch[1]
        const progress = totalLength > 0 ? currentTime / totalLength : 0

        return {
          currentTime,
          totalLength,
          state,
          progress
        }
      }

      return null
    } catch (error) {
      return null
    }
  }

  async playFile(filePath: string): Promise<boolean> {
    try {
      console.log('🎬 VLC Audio Manager: playFile called with path:', filePath)
      
      // Ensure VLC is running and completion checking is active
      if (!this.vlcProcess) {
        console.log('🎬 VLC Audio Manager: VLC not running, starting it...')
        await this.startVLC()
        // Wait a bit for VLC to fully start
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      
      // Ensure completion checking is running
      this.startCompletionChecking()
      
      // Stop any current playback
      await this.stop()
      
      // Load the file into VLC
      const addUrl = `http://localhost:${this.vlcPort}/requests/playlist.xml?command=in_play&input=${encodeURIComponent(filePath)}`
      const response = await fetch(addUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })

      if (!response.ok) {
        console.error('🎬 VLC Audio Manager: Failed to load file:', filePath)
        return false
      }

      // Wait for file to be loaded
      await new Promise(resolve => setTimeout(resolve, 500))

      // Start playback
      const playUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=pl_play`
      const playResponse = await fetch(playUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })

      if (playResponse.ok) {
        this.currentFile = filePath
        this.isPlaying = true
        this.startProgressPolling()
        console.log('🎬 VLC Audio Manager: File loaded and playback started:', filePath)
        return true
      } else {
        console.error('🎬 VLC Audio Manager: Failed to start playback')
        return false
      }
    } catch (error) {
      console.error('🎬 VLC Audio Manager: Error in playFile:', error)
      return false
    }
  }

  async stop(): Promise<boolean> {
    try {
      console.log('🛑 VLC Audio Manager: stop called')
      
      // Send stop command to VLC
      const stopUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=pl_stop`
      await fetch(stopUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })

      // Clear the playlist
      const clearUrl = `http://localhost:${this.vlcPort}/requests/playlist.xml?command=pl_empty`
      await fetch(clearUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })

      this.isPlaying = false
      this.currentFile = null
      this.stopProgressPolling()
      
      console.log('🎬 VLC Audio Manager: Playback stopped and playlist cleared')
      return true
    } catch (error) {
      console.error('🎬 VLC Audio Manager: Error stopping playback:', error)
      return false
    }
  }

  async pause(): Promise<boolean> {
    try {
      const pauseUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=pl_pause`
      const response = await fetch(pauseUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      return response.ok
    } catch (error) {
      console.error('🎬 VLC Audio Manager: Error pausing playback:', error)
      return false
    }
  }

  async resume(): Promise<boolean> {
    try {
      const resumeUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=pl_play`
      const response = await fetch(resumeUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      return response.ok
    } catch (error) {
      console.error('🎬 VLC Audio Manager: Error resuming playback:', error)
      return false
    }
  }

  async seek(position: number): Promise<boolean> {
    try {
      const seekUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=seek&val=${Math.floor(position)}`
      const response = await fetch(seekUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      return response.ok
    } catch (error) {
      console.error('🎬 VLC Audio Manager: Error seeking:', error)
      return false
    }
  }

  getStatus(): AudioStatus {
    return {
      isPlaying: this.isPlaying,
      currentFile: this.currentFile,
      hasProcess: this.vlcProcess !== null,
      platform: this.platform,
      wasPlayingBeforeKill: this.wasPlayingBeforeKill
    }
  }

  resetState(): void {
    this.isPlaying = false
    this.currentFile = null
    this.wasPlayingBeforeKill = false
  }

  async checkAndRestart(): Promise<boolean> {
    if (!this.vlcProcess) {
      await this.startVLC()
      return true
    }
    return false
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

  async setVolume(newVolume: number): Promise<number> {
    this.volume = Math.max(0, Math.min(1, newVolume))
    // VLC volume control would go here
    return this.volume * 100
  }

  getVolume(): number {
    return this.volume
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    return this.muted
  }

  isMuted(): boolean {
    return this.muted
  }

  getPlaybackProgress(): number {
    return this.latestProgress
  }

  isTrackFinished(): boolean {
    return !this.isPlaying && this.currentFile !== null
  }

  estimateDuration(filePath: string): number {
    // Simple estimation based on file size
    try {
      const stats = fs.statSync(filePath)
      const sizeInMB = stats.size / (1024 * 1024)
      // Rough estimate: 1MB ≈ 1 minute for compressed audio
      return Math.floor(sizeInMB * 60)
    } catch {
      return 0
    }
  }

  async killAllAudioProcesses(): Promise<void> {
    try {
      if (this.vlcProcess) {
        this.vlcProcess.kill('SIGKILL')
        this.vlcProcess = null
      }
      
      if (process.platform === 'win32') {
        exec('taskkill /f /im vlc.exe', () => {})
      } else {
        exec('pkill -f vlc', () => {})
      }
    } catch (error) {
      console.error('🎬 VLC Audio Manager: Error killing processes:', error)
    }
  }

  async forceStop(): Promise<boolean> {
    return this.stop()
  }

  muteSystemAudio(): void {
    // System audio muting would go here
  }

  unmuteSystemAudio(): void {
    // System audio unmuting would go here
  }

  setTrackCompleteCallback(callback: () => void): void {
    this.onTrackComplete = callback
  }

  clearTrackCompleteCallback(): void {
    this.onTrackComplete = null
  }

  clearCallbackForStop(): void {
    this.onTrackComplete = null
  }

  setProgressCallback(callback: (progress: number) => void): void {
    this.vlcProgressCallback = callback
  }

  getLatestProgress(): number {
    return this.latestProgress
  }

  getVLCProgress(): Promise<number> {
    return this.getVLCStatus().then(status => status?.progress || 0)
  }

  getVLCDuration(): Promise<number> {
    return this.getVLCStatus().then(status => status?.totalLength || 0)
  }

  markAsSkipped(): void {
    // Mark that we just skipped to this track
  }

  private startProgressPolling(): void {
    if (this.vlcProgressInterval) {
      clearInterval(this.vlcProgressInterval)
    }

    this.vlcProgressInterval = setInterval(async () => {
      try {
        const status = await this.getVLCStatus()
        if (status) {
          this.latestProgress = status.progress || 0
          if (this.vlcProgressCallback) {
            this.vlcProgressCallback(this.latestProgress)
          }
        }
      } catch (error) {
        console.error('🎬 VLC Audio Manager: Progress polling error:', error)
      }
    }, 1000)

    console.log('🎬 VLC Audio Manager: Progress polling started')
  }

  private stopProgressPolling(): void {
    if (this.vlcProgressInterval) {
      clearInterval(this.vlcProgressInterval)
      this.vlcProgressInterval = null
      console.log('🎬 VLC Audio Manager: Progress polling stopped')
    }
  }
}

export default AudioManager 


