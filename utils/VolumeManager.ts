import { exec } from 'child_process'

export class VolumeManager {
  private volume = 1.0
  private muted = false
  private readonly platform: string

  constructor() {
    this.platform = process.platform
    this.querySystemVolumeOnStartup()
  }

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
          console.log('Volume Manager: Error querying system volume:', error.message)
          console.log('Volume Manager: Using default volume:', this.volume)
        } else {
          try {
            const systemVolume = parseFloat(stdout.trim())
            if (!isNaN(systemVolume)) {
              const normalizedVolume = this.platform === 'win32' ? systemVolume : systemVolume / 100
              this.volume = Math.max(0, Math.min(1, normalizedVolume))
              console.log('Volume Manager: System volume queried on startup:', `${Math.round(this.volume * 100)}%`)
            } else {
              console.log('Volume Manager: Invalid system volume response, using default:', this.volume)
            }
          } catch (parseError) {
            console.log('Volume Manager: Error parsing system volume, using default:', this.volume)
          }
        }
      })
    } catch (error) {
      console.error('Volume Manager: Error in querySystemVolumeOnStartup:', error)
    }
  }

  async setVolume(volume: number): Promise<number> {
    this.volume = Math.max(0, Math.min(1, volume))
    return this.applySystemVolume()
  }

  private async applySystemVolume(): Promise<number> {
    return new Promise((resolve) => {
      const setAndVerify = (attempt: number = 1) => {
        let command: string
        
        if (this.platform === 'win32') {
          const volumePercent = Math.round(this.volume * 100)
          command = `powershell -Command "(Get-AudioDevice -Playback).Volume = ${volumePercent}"`
        } else {
          const volumePercent = Math.round(this.volume * 100)
          command = `osascript -e "set volume output volume ${volumePercent}"`
        }
        
        exec(command, async (error) => {
          if (error) {
            console.error('Volume Manager: Error setting volume:', error)
            resolve(this.volume)
            return
          }
          
          // Verify the volume was set correctly
          const actualVolume = await this.querySystemVolume()
          const expectedVolume = Math.round(this.volume * 100)
          const actualVolumeRounded = Math.round(actualVolume * 100)
          
          if (Math.abs(actualVolumeRounded - expectedVolume) <= 5) {
            console.log('Volume Manager: Volume set successfully:', `${expectedVolume}%`)
            resolve(this.volume)
          } else if (attempt < 3) {
            console.log('Volume Manager: Volume verification failed, retrying...')
            setTimeout(() => setAndVerify(attempt + 1), 100)
          } else {
            console.warn('Volume Manager: Volume verification failed after retries')
            resolve(this.volume)
          }
        })
      }
      
      setAndVerify()
    })
  }

  private async querySystemVolume(): Promise<number> {
    return new Promise((resolve) => {
      let command: string
      
      if (this.platform === 'win32') {
        command = 'powershell -Command "[math]::Round((Get-AudioDevice -Playback).Volume / 100, 2)"'
      } else {
        command = 'osascript -e "output volume of (get volume settings)"'
      }
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('Volume Manager: Error querying system volume:', error)
          resolve(this.volume)
        } else {
          try {
            const systemVolume = parseFloat(stdout.trim())
            if (!isNaN(systemVolume)) {
              const normalizedVolume = this.platform === 'win32' ? systemVolume : systemVolume / 100
              resolve(Math.max(0, Math.min(1, normalizedVolume)))
            } else {
              resolve(this.volume)
            }
          } catch (parseError) {
            console.error('Volume Manager: Error parsing system volume:', parseError)
            resolve(this.volume)
          }
        }
      })
    })
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
    let command: string
    
    if (this.platform === 'win32') {
      command = 'powershell -Command "(Get-AudioDevice -Playback).Muted = $true"'
    } else {
      command = 'osascript -e "set volume output muted true"'
    }
    
    exec(command, (error) => {
      if (error) {
        console.error('Volume Manager: Error muting system audio:', error)
      } else {
        console.log('Volume Manager: System audio muted')
      }
    })
  }

  unmuteSystemAudio(): void {
    let command: string
    
    if (this.platform === 'win32') {
      command = 'powershell -Command "(Get-AudioDevice -Playback).Muted = $false"'
    } else {
      command = 'osascript -e "set volume output muted false"'
    }
    
    exec(command, (error) => {
      if (error) {
        console.error('Volume Manager: Error unmuting system audio:', error)
      } else {
        console.log('Volume Manager: System audio unmuted')
      }
    })
  }

  isMuted(): boolean {
    return this.muted
  }
} 