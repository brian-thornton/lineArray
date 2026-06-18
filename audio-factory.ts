import AudioManager from './audio-manager'
import type { AudioManagerInterface } from './types/audio'

// VLC is now the only supported audio engine. The factory is kept as a thin
// singleton so the rest of the app can keep asking for "the current manager"
// without caring how it was constructed.
export type AudioPlayerType = 'vlc'

export class AudioFactory {
  private static instance: AudioFactory | null = null
  private currentManager: AudioManagerInterface | null = null
  private currentType: AudioPlayerType = 'vlc'

  static getInstance(): AudioFactory {
    if (!AudioFactory.instance) {
      AudioFactory.instance = new AudioFactory()
    }
    return AudioFactory.instance
  }

  createManager(_type: AudioPlayerType = 'vlc'): AudioManagerInterface {
    if (this.currentManager) {
      return this.currentManager
    }
    this.currentManager = new AudioManager()
    this.currentType = 'vlc'
    return this.currentManager
  }

  getCurrentManager(): AudioManagerInterface | null {
    return this.currentManager
  }

  getCurrentType(): AudioPlayerType {
    return this.currentType
  }
}

export default AudioFactory
