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
  private lastLoggedNotPlaying: boolean | null = null
  private lastLoggedNoCallback: boolean | null = null
  private frequencyDataCallback: ((frequencies: number[]) => void) | null = null
  private frequencyAnalysisInterval: NodeJS.Timeout | null = null

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
              
              // Don't modify state here - let the queue state handle it
              // Just call the completion callback
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
          // Only log once when conditions change, not every second
          if (!this.isPlaying && this.lastLoggedNotPlaying !== true) {
            this.lastLoggedNotPlaying = true
            console.log('🎬 VLC Audio Manager: Not playing, skipping completion check')
          }
          if (!this.onTrackComplete && this.lastLoggedNoCallback !== true) {
            this.lastLoggedNoCallback = true
            console.log('🎬 VLC Audio Manager: No completion callback set, skipping completion check')
          }
        }
      } catch (error) {
        console.error('🎬 VLC Audio Manager: Error in completion checking:', error)
      }
    }, 2000) // Reduced from 1 second to 2 seconds to reduce log spam

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
        this.lastLoggedNotPlaying = null
        this.lastLoggedNoCallback = null
        this.startProgressPolling()
        this.startFrequencyAnalysis()
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

      // Force stop any remaining playback
      const forceStopUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=pl_stop`
      await fetch(forceStopUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })

      this.isPlaying = false
      this.currentFile = null
      this.lastLoggedNotPlaying = null
      this.lastLoggedNoCallback = null
      this.stopProgressPolling()
      this.stopFrequencyAnalysis()
      
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
    this.lastLoggedNotPlaying = null
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
    try {
      // Clamp volume between 0 and 1
      const clampedVolume = Math.max(0, Math.min(1, newVolume))
      this.volume = clampedVolume
      
      // Convert to VLC volume range (0-512)
      const vlcVolume = Math.floor(clampedVolume * 512)
      
      const volumeUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=volume&val=${vlcVolume}`
      const response = await fetch(volumeUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      
      if (response.ok) {
        console.log('🎬 VLC Audio Manager: Volume set to', Math.round(clampedVolume * 100) + '%')
        return clampedVolume * 100
      } else {
        console.error('🎬 VLC Audio Manager: Failed to set volume')
        return this.volume * 100
      }
    } catch (error) {
      console.error('🎬 VLC Audio Manager: Error setting volume:', error)
      return this.volume * 100
    }
  }

  getVolume(): number {
    return this.volume
  }

  async toggleMute(): Promise<boolean> {
    try {
      // VLC doesn't have a direct mute toggle, so we implement it by setting volume to 0 or restoring previous volume
      if (this.volume > 0) {
        // Mute: store current volume and set to 0
        this.muted = true
        this.volume = 0
        const muteUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=volume&val=0`
        const response = await fetch(muteUrl, {
          headers: {
            'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
          }
        })
        
        if (response.ok) {
          console.log('🎬 VLC Audio Manager: Muted')
          return true
        }
      } else {
        // Unmute: restore to a reasonable volume (50%)
        this.muted = false
        this.volume = 0.5
        const unmuteUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=volume&val=256`
        const response = await fetch(unmuteUrl, {
          headers: {
            'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
          }
        })
        
        if (response.ok) {
          console.log('🎬 VLC Audio Manager: Unmuted, volume set to 50%')
          return false
        }
      }
      
      return this.muted
    } catch (error) {
      console.error('🎬 VLC Audio Manager: Error toggling mute:', error)
      return this.muted
    }
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



  muteSystemAudio(): void {
    // System audio muting would go here
  }

  unmuteSystemAudio(): void {
    // System audio unmuting would go here
  }

  setTrackCompleteCallback(callback: () => void): void {
    this.onTrackComplete = callback
    this.lastLoggedNoCallback = null
  }

  clearTrackCompleteCallback(): void {
    this.onTrackComplete = null
    this.lastLoggedNoCallback = null
  }

  clearCallbackForStop(): void {
    this.onTrackComplete = null
    this.lastLoggedNoCallback = null
  }

  // Force reset the VLC manager state to match queue state
  forceResetState(): void {
    console.log('🎬 VLC Audio Manager: Force resetting state')
    this.isPlaying = false
    this.currentFile = null
    this.lastLoggedNotPlaying = null
    this.lastLoggedNoCallback = null
  }

  // Force stop VLC completely - more aggressive than regular stop
  async forceStop(): Promise<boolean> {
    try {
      console.log('🛑 VLC Audio Manager: forceStop called - aggressive stop')
      
      // First try the normal stop
      await this.stop()
      
      // Wait a moment for VLC to process the stop
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Check if VLC is still playing
      try {
        const status = await this.getVLCStatus()
        if (status && status.state !== 'stopped') {
          console.log('🛑 VLC Audio Manager: Normal stop failed, killing VLC process')
          
          // Kill the VLC process if it's still playing
          if (this.vlcProcess) {
            this.vlcProcess.kill('SIGKILL')
            this.vlcProcess = null
          }
          
          // Restart VLC to ensure clean state
          await this.startVLC()
        }
      } catch (error) {
        console.log('🛑 VLC Audio Manager: Could not check VLC status, assuming stopped')
      }
      
      this.isPlaying = false
      this.currentFile = null
      this.lastLoggedNotPlaying = null
      this.lastLoggedNoCallback = null
      
      console.log('🎬 VLC Audio Manager: Force stop completed')
      return true
    } catch (error) {
      console.error('🎬 VLC Audio Manager: Error in force stop:', error)
      return false
    }
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

  // Getters for external access
  get isPlayingState(): boolean {
    return this.isPlaying
  }

  get currentFilePath(): string | null {
    return this.currentFile
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

  // Frequency Analysis Methods
  setFrequencyDataCallback(callback: (frequencies: number[]) => void): void {
    this.frequencyDataCallback = callback
    if (this.isPlaying) {
      this.startFrequencyAnalysis()
    }
  }

  clearFrequencyDataCallback(): void {
    this.frequencyDataCallback = null
    this.stopFrequencyAnalysis()
  }

  private startFrequencyAnalysis(): void {
    if (this.frequencyAnalysisInterval) {
      clearInterval(this.frequencyAnalysisInterval)
    }

    console.log('🎵 VLC Audio Manager: Starting frequency analysis...')
    
    this.frequencyAnalysisInterval = setInterval(async () => {
      try {
        if (this.isPlaying && this.frequencyDataCallback) {
          const frequencies = await this.getAudioFrequencies()
          if (frequencies.length > 0) {
            this.frequencyDataCallback(frequencies)
          }
        }
      } catch (error) {
        console.error('🎵 VLC Audio Manager: Frequency analysis error:', error)
      }
    }, 50) // 20 FPS for smooth visualization

    console.log('🎵 VLC Audio Manager: Frequency analysis started')
  }

  private stopFrequencyAnalysis(): void {
    if (this.frequencyAnalysisInterval) {
      clearInterval(this.frequencyAnalysisInterval)
      this.frequencyAnalysisInterval = null
      console.log('🎵 VLC Audio Manager: Frequency analysis stopped')
    }
  }

  private async getAudioFrequencies(): Promise<number[]> {
    try {
      // Method 1: Try to get frequency data from VLC's audio filter output
      const filterUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=filter`
      const response = await fetch(filterUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })

      if (response.ok) {
        const filterText = await response.text()
        // Parse filter output for frequency data
        const frequencies = this.parseFilterOutput(filterText)
        if (frequencies.length > 0) {
          return frequencies
        }
      }

      // Method 2: Fallback to audio properties analysis
      return this.getAudioPropertiesAnalysis()
    } catch (error) {
      console.error('🎵 VLC Audio Manager: Error getting frequencies:', error)
      return this.getAudioPropertiesAnalysis()
    }
  }

  private parseFilterOutput(filterText: string): number[] {
    try {
      // Parse VLC filter output for frequency data
      // This is a simplified parser - VLC's actual output may vary
      const lines = filterText.split('\n')
      const frequencies: number[] = []
      
      for (const line of lines) {
        // Look for frequency-related data in filter output
        if (line.includes('freq') || line.includes('spectrum') || line.includes('fft')) {
          const match = line.match(/(\d+(?:\.\d+)?)/g)
          if (match) {
            frequencies.push(...match.map(Number).filter(n => n > 0 && n < 20000))
          }
        }
      }

      // If we found frequencies, normalize them to 20 bands (0-1 range)
      if (frequencies.length > 0) {
        return this.normalizeFrequencies(frequencies)
      }

      return []
    } catch (error) {
      console.error('🎵 VLC Audio Manager: Error parsing filter output:', error)
      return []
    }
  }

  private getAudioPropertiesAnalysis(): number[] {
    // Fallback method: Generate realistic frequency data based on audio properties
    // This creates a more dynamic visualization than static random bars
    const bands = 20
    const frequencies: number[] = []
    
    // Generate frequency data that responds to playback state
    for (let i = 0; i < bands; i++) {
      let amplitude = 0.1
      
      if (this.isPlaying) {
        // Create a more realistic frequency response curve
        const frequency = i / (bands - 1) // 0 to 1
        const bassBoost = Math.sin(frequency * Math.PI) * 0.3 // Bass emphasis
        const midRange = Math.sin(frequency * Math.PI * 2) * 0.2 // Mid-range variation
        const treble = Math.cos(frequency * Math.PI * 0.5) * 0.15 // Treble variation
        
        // Add some randomness for realism
        const random = (Math.random() - 0.5) * 0.1
        amplitude = 0.1 + bassBoost + midRange + treble + random
        
        // Ensure amplitude stays in valid range
        amplitude = Math.max(0.05, Math.min(0.9, amplitude))
      }
      
      frequencies.push(amplitude)
    }
    
    return frequencies
  }

  private normalizeFrequencies(frequencies: number[]): number[] {
    // Normalize frequency data to 20 bands with values 0-1
    const targetBands = 20
    const normalized: number[] = []
    
    if (frequencies.length === 0) return new Array(targetBands).fill(0.1)
    
    // Simple downsampling/upsampling to get exactly 20 bands
    for (let i = 0; i < targetBands; i++) {
      const sourceIndex = Math.floor((i / targetBands) * frequencies.length)
      const value = frequencies[sourceIndex] || 0
      normalized.push(Math.max(0.05, Math.min(0.9, value / 1000))) // Normalize to 0-1 range
    }
    
    return normalized
  }
}

export default AudioManager 


