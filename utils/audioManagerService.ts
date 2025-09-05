import AudioManager from '../audio-manager'

// Singleton instance of AudioManager
let audioManagerInstance: AudioManager | null = null

export function getAudioManager(): AudioManager {
  if (!audioManagerInstance) {
    audioManagerInstance = new AudioManager()
  }
  return audioManagerInstance
}

export function getFrequencyData(): number[] {
  const manager: AudioManager = getAudioManager()
  const time = Date.now() * 0.001 // Current time in seconds
  const frequencies: number[] = []
  
  // Generate frequency data that's always engaging, but responds to playback state
  for (let i = 0; i < 20; i++) {
    const frequency = i / 19 // 0 to 1 across the frequency spectrum
    
    let amplitude = 0.1 // Base amplitude
    
    const audioStatus = manager.getAudioStatus()
    if (audioStatus.isPlaying && audioStatus.currentFile) {
      // When playing: create realistic frequency response
      
      // Bass frequencies (lower bands) have more energy
      const bassBoost = Math.sin(frequency * Math.PI) * 0.4
      
      // Mid-range frequencies have moderate energy
      const midRange = Math.sin(frequency * Math.PI * 2) * 0.2
      
      // Treble frequencies (higher bands) have less energy
      const treble = Math.cos(frequency * Math.PI * 0.5) * 0.15
      
      // Add rhythmic variation based on time
      const rhythm = Math.sin(time * 2 + frequency * Math.PI) * 0.15
      
      // Add some randomness for realism
      const random = (Math.random() - 0.5) * 0.08
      
      amplitude = 0.1 + bassBoost + midRange + treble + rhythm + random
    } else {
      // When not playing: create subtle, breathing animation
      
      // Create a gentle breathing effect
      const breathing = Math.sin(time * 0.5) * 0.05
      
      // Add subtle frequency variation
      const freqVariation = Math.sin(frequency * Math.PI * 3) * 0.03
      
      // Add very subtle randomness
      const random = (Math.random() - 0.5) * 0.02
      
      amplitude = 0.1 + breathing + freqVariation + random
    }
    
    // Ensure amplitude stays in valid range
    amplitude = Math.max(0.05, Math.min(0.9, amplitude))
    frequencies.push(amplitude)
  }
  
  return frequencies
}
