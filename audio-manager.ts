import { exec, type ChildProcess } from 'child_process'
import type { AudioStatus, CurrentSong, AudioManagerInterface } from './types/audio'
import { NetworkPathHandler } from './utils/networkPathHandler'

// Process-level lock so multiple AudioManager instances (from Next.js module reloads)
// don't race to start VLC simultaneously.
const g = global as typeof globalThis & {
  __vlcStarting?: boolean
}

class AudioManager implements AudioManagerInterface {
  private vlcProcess: ChildProcess | null = null
  private vlcPort: number = 8081
  private vlcPassword: string = 'jukebox'
  private onTrackComplete: (() => void) | null = null
  private currentFile: string | null = null
  private isPlaying = false
  private volume = 1.0
  private muted = false
  private volumeBeforeMute = 1.0 // Store volume before muting
  private platform: string = process.platform
  private completionCheckInterval: NodeJS.Timeout | null = null
  private trackStartTime: number = 0
  private _stoppedDuringLoad = false

  constructor() {
    console.log('🎬 Simple VLC Audio Manager: Initialized')
    this.startVLC()
  }

  private async startVLC(): Promise<void> {
    if (this.vlcProcess) {
      console.log('🎬 Simple VLC Audio Manager: VLC already running')
      return
    }

    // If another AudioManager instance is currently starting VLC, wait for it
    if (g.__vlcStarting) {
      console.log('🎬 Simple VLC Audio Manager: Another instance is starting VLC, waiting...')
      await new Promise(resolve => setTimeout(resolve, 4500))
    }

    // If another AudioManager instance already started VLC, reuse it
    const alreadyRunning = await this.verifyVLCRunning()
    if (alreadyRunning) {
      console.log('🎬 Simple VLC Audio Manager: VLC already running (from another instance), reusing')
      await this.syncVolumeFromVLC()
      return
    }

    // Acquire process-level lock
    g.__vlcStarting = true

    // Kill any stale VLC processes on our port before starting fresh
    await new Promise<void>(resolve => {
      exec(`pkill -f "vlc --intf http --http-port ${this.vlcPort}"`, () => resolve())
    })
    await new Promise(resolve => setTimeout(resolve, 500))

    const command = `vlc --intf http --http-port ${this.vlcPort} --http-password ${this.vlcPassword} --no-video --quiet --network-caching=1000 --live-caching=1000 --file-caching=1000 --sout-keep --sout-all --extraintf http`

    console.log('🎬 Simple VLC Audio Manager: Starting VLC...')
    console.log('🎬 Simple VLC Audio Manager: Command:', command)

    try {
      this.vlcProcess = exec(command)
      
      if (!this.vlcProcess) {
        console.error('🎬 Simple VLC Audio Manager: Failed to create VLC process')
        return
      }
      
      this.vlcProcess.on('exit', (code, signal) => {
        console.log('🎬 Simple VLC Audio Manager: VLC exited with code:', code, 'signal:', signal)
        this.vlcProcess = null
        // Only auto-restart on unexpected crash (no signal = natural exit/crash)
        // When killed intentionally via forceStop/stop, do NOT restart automatically
        // — playFile() will restart VLC when needed
        if (!signal && code !== 0) {
          console.log('🎬 Simple VLC Audio Manager: VLC crashed unexpectedly, restarting...')
          setTimeout(() => this.startVLC(), 2000)
        }
      })

      // Wait for VLC to start
      console.log('🎬 Simple VLC Audio Manager: Waiting for VLC to start...')
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Verify VLC is working
      console.log('🎬 Simple VLC Audio Manager: Verifying VLC is working...')
      const isWorking = await this.verifyVLCRunning()
      if (isWorking) {
        console.log('🎬 Simple VLC Audio Manager: VLC started successfully')
        await this.syncVolumeFromVLC()
      } else {
        console.error('🎬 Simple VLC Audio Manager: VLC failed to start - not responding to HTTP requests')
        if (this.vlcProcess) {
          this.vlcProcess.kill('SIGKILL')
        }
        this.vlcProcess = null
      }
    } catch (error) {
      console.error('🎬 Simple VLC Audio Manager: Error starting VLC:', error)
      this.vlcProcess = null
    } finally {
      // Release process-level lock
      g.__vlcStarting = false
    }
  }

  private async verifyVLCRunning(): Promise<boolean> {
    try {
      const statusUrl = `http://localhost:${this.vlcPort}/requests/status.xml`
      const response = await fetch(statusUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      return response.ok
    } catch (error) {
      return false
    }
  }

  async playFile(filePath: string): Promise<boolean> {
    try {
      console.log('🎬 Simple VLC Audio Manager: playFile called with path:', filePath)

      // Reset sentinel SYNCHRONOUSLY before any await so forceStop() called
      // during any of the awaits below can still be detected.
      this._stoppedDuringLoad = false

      // Verify VLC is responding; start it if needed.
      // startVLC() handles its own startup wait internally, so no extra sleep here.
      const isWorking = await this.verifyVLCRunning()
      if (!isWorking) {
        console.log('🎬 Simple VLC Audio Manager: VLC not responding, starting...')
        this.vlcProcess = null
        await this.startVLC()
        const retryWorking = await this.verifyVLCRunning()
        if (!retryWorking) {
          console.error('🎬 Simple VLC Audio Manager: VLC still not responding after restart')
          return false
        }
      }

      // Stop any current playback
      await this.stop()

      // Set up completion checking
      this.setupCompletionChecking()

      // Load and play the file
      const success = await this.loadAndPlayFile(filePath)

      // forceStop() may have been called while loadAndPlayFile was awaiting HTTP responses.
      // It sets _stoppedDuringLoad=true and sends pl_stop to VLC, but our
      // pl_empty+in_play+pl_play commands may have arrived at VLC AFTER the pl_stop,
      // leaving VLC playing despite the stop command. Re-stop VLC now to fix that.
      if (this._stoppedDuringLoad) {
        console.log('🎬 Simple VLC Audio Manager: Stop was called during file load — re-stopping VLC')
        this.stopCompletionChecking()
        await this.stop()
        return false
      }

      if (success) {
        this.isPlaying = true
        this.currentFile = filePath
        this.trackStartTime = Date.now() // reset grace period from actual play start
        console.log('🎬 Simple VLC Audio Manager: Successfully started playback')
      }

      return success
    } catch (error) {
      console.error('🎬 Simple VLC Audio Manager: Error in playFile:', error)
      return false
    }
  }

  private async loadAndPlayFile(filePath: string): Promise<boolean> {
    try {
      // Handle network share paths
      if (NetworkPathHandler.isNetworkSharePath(filePath)) {
        return await this.playNetworkShareFile(filePath)
      } else {
        return await this.loadLocalFile(filePath)
      }
    } catch (error) {
      console.error('🎬 Simple VLC Audio Manager: Error loading file:', error)
      return false
    }
  }

  private async playNetworkShareFile(filePath: string): Promise<boolean> {
    console.log('🌐 Simple VLC Audio Manager: Playing network share file:', filePath)
    
    const pathOptions = NetworkPathHandler.getNetworkSharePathOptions(filePath)
    console.log('🌐 Simple VLC Audio Manager: Path options:', pathOptions)
    
    for (let i = 0; i < pathOptions.length; i++) {
      const path = pathOptions[i]
      console.log(`🌐 Simple VLC Audio Manager: Trying path ${i + 1}/${pathOptions.length}: ${path}`)
      
      try {
        const success = await this.loadLocalFile(path)
        if (success) {
          console.log(`🌐 Simple VLC Audio Manager: Successfully loaded with path: ${path}`)
          return true
        }
      } catch (error) {
        console.log(`🌐 Simple VLC Audio Manager: Path ${i + 1} failed:`, error)
      }
    }
    
    console.error('🌐 Simple VLC Audio Manager: All path options failed')
    return false
  }

  private async loadLocalFile(filePath: string): Promise<boolean> {
    try {
      // Clear playlist
      const clearUrl = `http://localhost:${this.vlcPort}/requests/playlist.xml?command=pl_empty`
      await fetch(clearUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })

      // Load file
      const loadUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=in_play&input=${encodeURIComponent(filePath)}`
      const loadResponse = await fetch(loadUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })

      if (!loadResponse.ok) {
        console.error('🎬 Simple VLC Audio Manager: Failed to load file')
        return false
      }

      // Start playback
      const playUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=pl_play`
      const playResponse = await fetch(playUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })

      if (!playResponse.ok) {
        console.error('🎬 Simple VLC Audio Manager: Failed to start playback')
        return false
      }

      console.log('🎬 Simple VLC Audio Manager: File loaded and playback started')
      return true
    } catch (error) {
      console.error('🎬 Simple VLC Audio Manager: Error loading local file:', error)
      return false
    }
  }

  private setupCompletionChecking(): void {
    // Clear any existing interval
    if (this.completionCheckInterval) {
      clearInterval(this.completionCheckInterval)
    }

    console.log('🎬 Simple VLC Audio Manager: Setting up completion checking...')
    this.trackStartTime = Date.now()

    this.completionCheckInterval = setInterval(async () => {
      if (!this.isPlaying || !this.onTrackComplete) {
        return
      }

      // Grace period: ignore stale VLC state from the previous track for the
      // first second after a new track starts (prevents double-advance)
      if (Date.now() - this.trackStartTime < 1000) {
        return
      }

      try {
        const status = await this.getVLCStatus()
        // Re-check after async gap: stop() or forceStop() may have run while we awaited
        if (!this.isPlaying || !this.onTrackComplete) return
        if (status) {
          const isStopped = status.state === 'stopped'
          const isNearEnd = status.totalLength > 0 && status.currentTime >= status.totalLength - 1
          const isProgressComplete = status.progress >= 99.9

          if (isStopped || isNearEnd || isProgressComplete) {
            console.log('🎬 Simple VLC Audio Manager: Track completed - isStopped:', isStopped, 'isNearEnd:', isNearEnd, 'isProgressComplete:', isProgressComplete)
            this.stopCompletionChecking()
            this.isPlaying = false
            this.currentFile = null
            this.onTrackComplete?.()
          }
        }
      } catch (error) {
        console.error('🎬 Simple VLC Audio Manager: Error in completion checking:', error)
      }
    }, 250) // Check every 250ms for fast track transitions
  }

  private stopCompletionChecking(): void {
    if (this.completionCheckInterval) {
      clearInterval(this.completionCheckInterval)
      this.completionCheckInterval = null
      console.log('🎬 Simple VLC Audio Manager: Completion checking stopped')
    }
  }

  async stop(): Promise<boolean> {
    try {
      console.log('🛑 Simple VLC Audio Manager: stop called')

      // Stop completion checking
      this.stopCompletionChecking()
      
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
      
      console.log('🎬 Simple VLC Audio Manager: Playback stopped')
      return true
    } catch (error) {
      console.error('🎬 Simple VLC Audio Manager: Error stopping playback:', error)
      return false
    }
  }

  async getVLCStatus(): Promise<any> {
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

      const text = await response.text()

      // Simple XML parsing without DOMParser (server-side compatible)
      const stateMatch = text.match(/<state>([^<]*)<\/state>/)
      const timeMatch = text.match(/<time>([^<]*)<\/time>/)
      const lengthMatch = text.match(/<length>([^<]*)<\/length>/)
      const volumeMatch = text.match(/<volume>([^<]*)<\/volume>/)

      const state = stateMatch ? stateMatch[1] : 'stopped'
      const currentTime = timeMatch ? parseFloat(timeMatch[1]) : 0
      const totalLength = lengthMatch ? parseFloat(lengthMatch[1]) : 0
      const progress = totalLength > 0 ? (currentTime / totalLength) * 100 : 0

      // Keep internal volume in sync with VLC's actual volume
      if (volumeMatch) {
        const vlcVolume = parseFloat(volumeMatch[1])
        this.volume = Math.max(0, Math.min(1, vlcVolume / 512))
      }

      return {
        state,
        currentTime,
        totalLength,
        progress
      }
    } catch (error) {
      console.error('🎬 Simple VLC Audio Manager: Error getting VLC status:', error)
      return null
    }
  }

  // Sync this.volume with whatever VLC is actually set to
  private async syncVolumeFromVLC(): Promise<void> {
    try {
      const statusUrl = `http://localhost:${this.vlcPort}/requests/status.xml`
      const response = await fetch(statusUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      if (!response.ok) return
      const text = await response.text()
      const volumeMatch = text.match(/<volume>([^<]*)<\/volume>/)
      if (volumeMatch) {
        const vlcVolume = parseFloat(volumeMatch[1])
        this.volume = Math.max(0, Math.min(1, vlcVolume / 512))
        console.log('🎬 Simple VLC Audio Manager: Synced volume from VLC:', Math.round(this.volume * 100) + '%')
      }
    } catch (error) {
      console.error('🎬 Simple VLC Audio Manager: Error syncing volume from VLC:', error)
    }
  }

  // Stub methods for interface compatibility
  async resetVLCState(): Promise<void> {
    // No-op for simple implementation
  }

  setTrackCompleteCallback(callback: (() => void) | null): void {
    this.onTrackComplete = callback
  }

  async setVolume(volume: number): Promise<number> {
    try {
      // Clamp volume between 0 and 1
      const clampedVolume = Math.max(0, Math.min(1, volume))
      this.volume = clampedVolume
      
      // Update muted state based on volume
      if (clampedVolume === 0) {
        this.muted = true
      } else {
        this.muted = false
        // Update volumeBeforeMute if we're setting a non-zero volume
        this.volumeBeforeMute = clampedVolume
      }
      
      // Convert to VLC volume range (0-512)
      const vlcVolume = Math.floor(clampedVolume * 512)
      
      const volumeUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=volume&val=${vlcVolume}`
      const response = await fetch(volumeUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      
      if (response.ok) {
        // Parse the actual volume VLC confirms back (in case it clamped differently)
        const text = await response.text()
        const volumeMatch = text.match(/<volume>([^<]*)<\/volume>/)
        if (volumeMatch) {
          const vlcVolume = parseFloat(volumeMatch[1])
          this.volume = Math.max(0, Math.min(1, vlcVolume / 512))
        }
        console.log('🎬 Simple VLC Audio Manager: Volume set to', Math.round(this.volume * 100) + '%')
        return this.volume
      } else {
        console.error('🎬 Simple VLC Audio Manager: Failed to set volume')
        return this.volume
      }
    } catch (error) {
      console.error('🎬 Simple VLC Audio Manager: Error setting volume:', error)
      return this.volume
    }
  }

  getVolume(): number {
    return this.volume
  }

  setMuted(muted: boolean): void {
    if (muted === this.muted) return
    
    if (muted) {
      // Store current volume before muting
      this.volumeBeforeMute = this.volume > 0 ? this.volume : 0.5
      void this.setVolume(0)
    } else {
      // Restore volume before mute
      void this.setVolume(this.volumeBeforeMute)
    }
    this.muted = muted
  }

  isMuted(): boolean {
    // Return true if muted flag is set or volume is 0
    return this.muted || this.volume === 0
  }

  getCurrentSong(): CurrentSong {
    if (!this.isPlaying || !this.currentFile) {
      return {
        file: null,
        title: 'No track playing'
      }
    }

    return {
      file: this.currentFile,
      title: this.currentFile.split('/').pop() || 'Unknown'
    }
  }

  getAudioStatus(): AudioStatus {
    // Check if VLC process is actually running
    const hasValidProcess = this.vlcProcess !== null && !this.vlcProcess.killed
    
    return {
      isPlaying: this.isPlaying,
      currentFile: this.currentFile,
      hasProcess: hasValidProcess,
      platform: this.platform,
      wasPlayingBeforeKill: false
    }
  }

  setProgressCallback(callback: ((progress: number) => void) | null): void {
    // TODO: Implement progress tracking
  }

  setFrequencyDataCallback(callback: (frequencies: number[]) => void): void {
    // TODO: Implement frequency analysis
  }

  async forceStop(): Promise<boolean> {
    try {
      console.log('🛑 Simple VLC Audio Manager: forceStop called')

      // Stop completion checking first to prevent the interval from
      // firing the callback while we're stopping.
      this.stopCompletionChecking()

      // Signal to any in-flight playFile that a stop was requested.
      // playFile checks this flag after loadAndPlayFile returns and re-stops VLC
      // if our pl_stop arrived at VLC before the in-flight pl_play.
      this._stoppedDuringLoad = true

      // Reset local state immediately
      this.isPlaying = false
      this.currentFile = null

      // Send stop + playlist clear to VLC
      await this.stop()

      console.log('🛑 Simple VLC Audio Manager: Force stop completed')
      return true
    } catch (error) {
      console.error('🛑 Simple VLC Audio Manager: Error in forceStop:', error)
      return false
    }
  }

  // Additional required methods for interface compatibility
  async pause(): Promise<boolean> {
    try {
      const pauseUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=pl_pause`
      await fetch(pauseUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      return true
    } catch (error) {
      console.error('🎬 Simple VLC Audio Manager: Error pausing:', error)
      return false
    }
  }

  async resume(): Promise<boolean> {
    try {
      const resumeUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=pl_play`
      await fetch(resumeUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      return true
    } catch (error) {
      console.error('🎬 Simple VLC Audio Manager: Error resuming:', error)
      return false
    }
  }

  async seek(position: number): Promise<boolean> {
    try {
      const seekUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=seek&val=${position}`
      await fetch(seekUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      return true
    } catch (error) {
      console.error('🎬 Simple VLC Audio Manager: Error seeking:', error)
      return false
    }
  }

  getStatus(): AudioStatus {
    return this.getAudioStatus()
  }

  resetState(): void {
    this.isPlaying = false
    this.currentFile = null
    this.stopCompletionChecking()
  }

  async checkAndRestart(): Promise<boolean> {
    const isWorking = await this.verifyVLCRunning()
    if (!isWorking) {
      await this.startVLC()
      return await this.verifyVLCRunning()
    }
    return true
  }

  setCurrentFile(filePath: string): void {
    this.currentFile = filePath
  }

  async toggleMute(): Promise<boolean> {
    if (!this.muted) {
      // Mute: store current volume and set to 0
      this.volumeBeforeMute = this.volume > 0 ? this.volume : 0.5
      await this.setVolume(0)
      this.muted = true
      console.log('🎬 Simple VLC Audio Manager: Muted (volume was', Math.round(this.volumeBeforeMute * 100) + '%)')
    } else {
      // Unmute: restore volume before mute
      await this.setVolume(this.volumeBeforeMute)
      this.muted = false
      console.log('🎬 Simple VLC Audio Manager: Unmuted (volume restored to', Math.round(this.volumeBeforeMute * 100) + '%)')
    }
    return this.muted
  }

  getPlaybackProgress(): number {
    // TODO: Implement progress tracking
    return 0
  }

  isTrackFinished(): boolean {
    return !this.isPlaying
  }

  estimateDuration(filePath: string): number {
    // TODO: Implement duration estimation
    return 0
  }

  async killAllAudioProcesses(): Promise<void> {
    if (this.vlcProcess) {
      this.vlcProcess.kill('SIGKILL')
      this.vlcProcess = null
    }
  }

  muteSystemAudio(): void {
    // TODO: Implement system audio muting
  }

  unmuteSystemAudio(): void {
    // TODO: Implement system audio unmuting
  }

  clearTrackCompleteCallback(): void {
    this.onTrackComplete = null
  }

  clearCallbackForStop(): void {
    this.onTrackComplete = null
  }

  forceResetState(): void {
    this.resetState()
  }

  getLatestProgress(): number {
    return this.getPlaybackProgress()
  }

  async getVLCProgress(): Promise<number> {
    const status = await this.getVLCStatus()
    return status ? status.currentTime : 0
  }

  async getVLCDuration(): Promise<number> {
    const status = await this.getVLCStatus()
    return status ? status.totalLength : 0
  }

  markAsSkipped(): void {
    // TODO: Implement skip tracking
  }
}

export default AudioManager