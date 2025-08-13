import { exec, type ChildProcess } from 'child_process'

export interface VLCStatus {
  currentTime: number
  totalLength: number
  state: string
  progress: number
}

export class VLCManager {
  private vlcProcess: ChildProcess | null = null
  private vlcPort: number = 8080
  private vlcPassword: string = 'jukebox'
  private vlcProgressInterval: NodeJS.Timeout | null = null
  private vlcProgressCallback: ((progress: number) => void) | null = null
  private latestProgress: number = 0
  private currentVolume: number = 1.0 // Store current volume (0.0 to 1.0)

  setProgressCallback(callback: (progress: number) => void): void {
    this.vlcProgressCallback = callback
  }

  getLatestProgress(): number {
    return this.latestProgress
  }

  // Volume control methods
  async setVolume(volume: number): Promise<number> {
    try {
      // Clamp volume between 0 and 1
      const clampedVolume = Math.max(0, Math.min(1, volume))
      this.currentVolume = clampedVolume
      
      // Convert to VLC volume range (0-512)
      const vlcVolume = Math.floor(clampedVolume * 512)
      
      const volumeUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=volume&val=${vlcVolume}`
      const response = await fetch(volumeUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      
      if (response.ok) {
        console.log('VLC Manager: Volume set to', Math.round(clampedVolume * 100) + '%')
        return clampedVolume
      } else {
        console.error('VLC Manager: Failed to set volume')
        return this.currentVolume
      }
    } catch (error) {
      console.error('VLC Manager: Error setting volume:', error)
      return this.currentVolume
    }
  }

  getVolume(): number {
    return this.currentVolume
  }

  async toggleMute(): Promise<boolean> {
    try {
      // VLC doesn't have a direct mute toggle, so we implement it by setting volume to 0 or restoring previous volume
      if (this.currentVolume > 0) {
        // Mute: store current volume and set to 0
        this.currentVolume = 0
        const muteUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=volume&val=0`
        const response = await fetch(muteUrl, {
          headers: {
            'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
          }
        })
        
        if (response.ok) {
          console.log('VLC Manager: Muted')
          return true
        }
      } else {
        // Unmute: restore to a reasonable volume (50%)
        this.currentVolume = 0.5
        const unmuteUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=volume&val=256`
        const response = await fetch(unmuteUrl, {
          headers: {
            'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
          }
        })
        
        if (response.ok) {
          console.log('VLC Manager: Unmuted, volume set to 50%')
          return false
        }
      }
      
      return this.currentVolume === 0
    } catch (error) {
      console.error('VLC Manager: Error toggling mute:', error)
      return this.currentVolume === 0
    }
  }

  isMuted(): boolean {
    return this.currentVolume === 0
  }

  async startVLC(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.vlcProcess) {
        console.log('VLC Manager: VLC already running')
        resolve(true)
        return
      }

      const platform = process.platform
      let command: string

      if (platform === 'win32') {
        command = `vlc --intf http --http-port ${this.vlcPort} --http-password ${this.vlcPassword} --no-video --no-qt-error-dialogs --no-qt-system-tray`
      } else {
        command = `vlc --intf http --http-port ${this.vlcPort} --http-password ${this.vlcPassword} --no-video --quiet`
      }

      console.log('VLC Manager: Starting VLC with command:', command)

      this.vlcProcess = exec(command, (error) => {
        if (error) {
          console.error('VLC Manager: VLC process error:', error)
        }
      })

      this.vlcProcess.on('exit', (code) => {
        console.log('VLC Manager: VLC process exited with code:', code)
        this.vlcProcess = null
      })

      // Wait for VLC to start
      setTimeout(() => {
        this.checkVLCStatus().then((isRunning) => {
          if (isRunning) {
            console.log('VLC Manager: VLC started successfully')
            resolve(true)
          } else {
            console.error('VLC Manager: VLC failed to start')
            this.vlcProcess = null
            resolve(false)
          }
        })
      }, 2000)
    })
  }

  private async checkVLCStatus(): Promise<boolean> {
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

  async loadFile(filePath: string): Promise<boolean> {
    try {
      const addUrl = `http://localhost:${this.vlcPort}/requests/playlist.xml?command=in_play&input=${encodeURIComponent(filePath)}`
      const response = await fetch(addUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })

      if (!response.ok) {
        console.error('VLC Manager: Failed to load file:', filePath)
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
        console.log('VLC Manager: File loaded and playback started:', filePath)
        return true
      } else {
        console.error('VLC Manager: Failed to start playback')
        return false
      }
    } catch (error) {
      console.error('VLC Manager: Error loading file:', error)
      return false
    }
  }

  async loadFileWithSeek(filePath: string, seekTimeSeconds: number): Promise<boolean> {
    try {
      // First load the file
      const addUrl = `http://localhost:${this.vlcPort}/requests/playlist.xml?command=in_play&input=${encodeURIComponent(filePath)}`
      const response = await fetch(addUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })

      if (!response.ok) {
        console.error('VLC Manager: Failed to load file with seek:', filePath)
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

      if (!playResponse.ok) {
        console.error('VLC Manager: Failed to start playback with seek')
        return false
      }

      // Wait a bit more for playback to start
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Seek to position
      const seekUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=seek&val=${Math.floor(seekTimeSeconds)}`
      const seekResponse = await fetch(seekUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })

      if (seekResponse.ok) {
        console.log('VLC Manager: File loaded with seek:', filePath, 'at', seekTimeSeconds, 'seconds')
        return true
      } else {
        console.error('VLC Manager: Failed to seek to position')
        return false
      }
    } catch (error) {
      console.error('VLC Manager: Error loading file with seek:', error)
      return false
    }
  }

  async getStatus(): Promise<VLCStatus | null> {
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
      console.error('VLC Manager: Error getting status:', error)
      return null
    }
  }

  async getProgress(): Promise<number> {
    const status = await this.getStatus()
    return status?.progress || 0
  }

  async getDuration(): Promise<number> {
    const status = await this.getStatus()
    return status?.totalLength || 0
  }

  async stop(): Promise<boolean> {
    try {
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

      // Wait for VLC to actually stop
      let stopped = false
      for (let i = 0; i < 10; i++) {
        const status = await this.getStatus()
        if (status?.state === 'stopped') {
          stopped = true
          break
        }
        await new Promise(res => setTimeout(res, 200))
      }

      if (stopped) {
        console.log('VLC Manager: Playback stopped and playlist cleared')
        return true
      } else {
        console.warn('VLC Manager: VLC did not confirm stopped state')
        return false
      }
    } catch (error) {
      console.error('VLC Manager: Error stopping playback:', error)
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
      console.error('VLC Manager: Error pausing playback:', error)
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
      console.error('VLC Manager: Error resuming playback:', error)
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
      console.error('VLC Manager: Error seeking:', error)
      return false
    }
  }

  startProgressPolling(): void {
    if (this.vlcProgressInterval) {
      clearInterval(this.vlcProgressInterval)
    }

    this.vlcProgressInterval = setInterval(async () => {
      try {
        const progress = await this.getProgress()
        this.latestProgress = progress
        if (this.vlcProgressCallback) {
          this.vlcProgressCallback(progress)
        }
      } catch (error) {
        console.error('VLC Manager: Progress polling error:', error)
      }
    }, 1000)

    console.log('VLC Manager: Progress polling started')
  }

  stopProgressPolling(): void {
    if (this.vlcProgressInterval) {
      clearInterval(this.vlcProgressInterval)
      this.vlcProgressInterval = null
      console.log('VLC Manager: Progress polling stopped')
    }
  }

  async checkCompletion(onComplete: () => void): Promise<void> {
    const status = await this.getStatus()
    if (status) {
      const { currentTime, totalLength, state } = status
      if (state === 'stopped' || (totalLength > 0 && currentTime >= totalLength - 1)) {
        console.log('VLC Manager: Track finished detected')
        onComplete()
      }
    }
  }

  isRunning(): boolean {
    return this.vlcProcess !== null
  }

  cleanup(): void {
    this.stopProgressPolling()
    if (this.vlcProcess) {
      this.vlcProcess.kill()
      this.vlcProcess = null
    }
  }
} 