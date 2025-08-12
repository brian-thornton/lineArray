import AudioManager from './audio-manager'
import MPDManager from './mpd-manager'
import type { AudioManagerInterface } from './types/audio'
import { exec } from 'child_process'

export type AudioPlayerType = 'vlc' | 'mpd'

export class AudioFactory {
  private static instance: AudioFactory | null = null
  private currentManager: AudioManagerInterface | null = null
  private currentType: AudioPlayerType = 'vlc'

  private constructor() {}

  static getInstance(): AudioFactory {
    if (!AudioFactory.instance) {
      AudioFactory.instance = new AudioFactory()
    }
    return AudioFactory.instance
  }

  createManager(type: AudioPlayerType): AudioManagerInterface {
    console.log('🏭 Audio Factory: createManager called with type:', type)
    console.log('🏭 Audio Factory: Current type:', this.currentType, 'Current manager:', this.currentManager ? 'exists' : 'null')
    
    if (this.currentType === type && this.currentManager) {
      console.log('🏭 Audio Factory: Reusing existing manager of type:', type)
      return this.currentManager
    }

    // Clean up existing manager
    if (this.currentManager) {
      console.log('🧹 Audio Factory: Cleaning up existing manager...')
      this.cleanupManager()
    }

    // Create new manager
    switch (type) {
      case 'mpd':
        console.log('🎵 Audio Factory: Creating new MPDManager')
        this.currentManager = new MPDManager()
        this.currentType = 'mpd'
        break
      case 'vlc':
      default:
        console.log('🎬 Audio Factory: Creating new AudioManager (VLC)')
        this.currentManager = new AudioManager()
        this.currentType = 'vlc'
        break
    }

    console.log('✅ Audio Factory: Created manager of type:', this.currentType)
    return this.currentManager
  }

  getCurrentManager(): AudioManagerInterface | null {
    return this.currentManager
  }

  getCurrentType(): AudioPlayerType {
    return this.currentType
  }

  private cleanupManager(): void {
    if (this.currentManager) {
      try {
        // Stop any current playback
        this.currentManager.forceStop()
        this.currentManager.killAllAudioProcesses()
        
        // BRUTE FORCE: Kill ALL VLC processes when switching away from VLC
        if (this.currentType === 'vlc') {
          this.killAllVLCProcesses()
        }
      } catch (error) {
        // Ignore cleanup errors
      }
      this.currentManager = null
    }
  }

  private killAllVLCProcesses(): void {
    try {
      if (process.platform === 'win32') {
        exec('taskkill /f /im vlc.exe', () => {})
      } else {
        exec('pkill -f vlc', () => {})
        exec('pkill -f "vlc --intf http"', () => {})
      }
    } catch (error) {
      // Ignore errors
    }
  }

  async switchPlayer(type: AudioPlayerType): Promise<AudioManagerInterface> {
    if (this.currentType === type) {
      return this.currentManager!
    }

    // Create new manager of the requested type
    return this.createManager(type)
  }
}

export default AudioFactory
