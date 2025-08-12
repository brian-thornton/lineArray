import fs from 'fs'
import path from 'path'
import AudioFactory, { type AudioPlayerType } from './audio-factory'
import logger from './utils/serverLogger'
import type { QueueTrack, QueueState, DebugInfo, AudioManagerInterface, QueueStateInterface } from './types/audio'

// Function to load audio player preference from settings
function loadAudioPlayerPreference(): AudioPlayerType {
  try {
    const settingsPath = path.join(process.cwd(), 'data', 'settings.json')
    console.log('📁 Queue State: Loading audio player preference from:', settingsPath)
    
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8')
      const settings = JSON.parse(data) as { audioPlayer?: AudioPlayerType }
      if (settings.audioPlayer && ['vlc', 'mpd'].includes(settings.audioPlayer)) {
        console.log('🎵 Queue State: Loaded audio player preference:', settings.audioPlayer)
        logger.info('Queue state: Loaded audio player preference: ' + settings.audioPlayer, 'QueueState')
        return settings.audioPlayer
      } else {
        console.log('⚠️ Queue State: Invalid or missing audioPlayer in settings:', settings.audioPlayer)
      }
    } else {
      console.log('⚠️ Queue State: Settings file not found')
    }
  } catch (error) {
    console.error('💥 Queue State: Error loading audio player preference:', error)
    logger.error('Queue state: Error loading audio player preference, using default', 'QueueState', error)
  }
  
  console.log('🎬 Queue State: Using default audio player: vlc')
  logger.info('Queue state: Using default audio player: vlc', 'QueueState')
  return 'vlc'
}

// Function to check and reload audio player preference if needed
function checkAndReloadAudioPlayerPreference(): void {
  try {
    const newPreference = loadAudioPlayerPreference()
    const currentType = audioFactory.getCurrentType()
    
    if (newPreference !== currentType) {
      logger.info('Queue state: Audio player preference changed, switching from ' + currentType + ' to ' + newPreference, 'QueueState')
      void switchAudioPlayer(newPreference)
    }
  } catch (error) {
    logger.error('Queue state: Error checking audio player preference', 'QueueState', error)
  }
}

// Check audio player preference every 30 seconds to catch settings changes
setInterval(checkAndReloadAudioPlayerPreference, 30000)

// Function to reload audio player preference and update manager
function reloadAudioPlayerPreference(): void {
  checkAndReloadAudioPlayerPreference()
}

// Initialize with audio player preference from settings
const audioFactory = AudioFactory.getInstance()
const preferredAudioPlayer = loadAudioPlayerPreference()
console.log('🎯 Queue State: Initializing with audio player:', preferredAudioPlayer)
let audio: AudioManagerInterface = audioFactory.createManager(preferredAudioPlayer)
console.log('✅ Queue State: Audio manager initialized:', audio.constructor.name)

let queue: QueueTrack[] = []
let currentTrack: QueueTrack | null = null
let isPlaying: boolean = false
let progress: number = 0
let volume: number = 1.0
let isMuted: boolean = false
let isStopping: boolean = false


// File path for persisting queue state
const STATE_FILE_PATH = path.join(process.cwd(), 'data', 'queue-state.json')

// Save queue state to file
function saveState(): void {
  try {
    const state: QueueState = {
      queue,
      currentTrack,
      timestamp: Date.now()
    }
    
    // Ensure data directory exists
    const dataDir = path.dirname(STATE_FILE_PATH)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2))
    console.log('Queue state saved to:', STATE_FILE_PATH)
  } catch (error) {
    console.error('Error saving queue state:', error)
  }
}

// Load queue state from file
function loadState(): void {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const data = fs.readFileSync(STATE_FILE_PATH, 'utf-8')
      const state: QueueState = JSON.parse(data)
      
      // Only restore if the state is recent (within last 24 hours)
      const isRecent = (Date.now() - state.timestamp) < (24 * 60 * 60 * 1000)
      
      if (isRecent && state.queue && Array.isArray(state.queue)) {
        queue = state.queue
        currentTrack = state.currentTrack
        console.log('Queue state restored from:', STATE_FILE_PATH)
        console.log('Restored queue length:', queue.length)
        console.log('Restored current track:', currentTrack)
      } else {
        console.log('Queue state is too old or invalid, starting fresh')
      }
    }
  } catch (error) {
    console.error('Error loading queue state:', error)
  }
}

// Load state on module initialization
loadState()

// Function to switch audio player
async function switchAudioPlayer(playerType: AudioPlayerType): Promise<void> {
  try {
    logger.info('Queue state: Switching audio player to: ' + playerType, 'QueueState')
    
    // Stop current playback if any
    if (isPlaying) {
      await audio.forceStop()
    }
    
    // BRUTE FORCE: If switching FROM VLC, kill ALL VLC processes
    if (audioFactory.getCurrentType() === 'vlc') {
      logger.info('Queue state: Killing all VLC processes before switching to MPD', 'QueueState')
      try {
        if (process.platform === 'win32') {
          const { exec } = await import('child_process')
          exec('taskkill /f /im vlc.exe', () => {})
        } else {
          const { exec } = await import('child_process')
          exec('pkill -f vlc', () => {})
          exec('pkill -f "vlc --intf http"', () => {})
        }
      } catch (error) {
        logger.error('Queue state: Error killing VLC processes', 'QueueState', error)
      }
    }
    
    // Switch to new player
    audio = await audioFactory.switchPlayer(playerType)
    
    // Re-setup callbacks with new audio manager
    audio.setTrackCompleteCallback(() => {
      if (isStopping) {
        logger.info('Queue state: Track completion ignored - stopping in progress', 'QueueState')
        return
      }
      logger.info('Queue state: Track completed, playing next in queue', 'QueueState')
      void playNextInQueue()
    })
    
    audio.setProgressCallback((newProgress: number) => {
      progress = newProgress
    })
    
    // Sync volume with new audio manager
    syncVolumeWithAudioManager()
    
    logger.info('Queue state: Audio player switched successfully', 'QueueState')
  } catch (error) {
    logger.error('Queue state: Error switching audio player', 'QueueState', error)
  }
}

// Sync volume with audio manager on startup
function syncVolumeWithAudioManager(): void {
  const audioVolume = audio.getVolume()
  volume = audioVolume
  isMuted = audio.isMuted()
  logger.info('Queue state: Synced volume with audio manager: ' + Math.round(volume * 100) + '%', 'QueueState')
}

// Sync volume after a short delay to allow audio manager to query system volume
setTimeout(syncVolumeWithAudioManager, 1000)

// Set up the track completion callback
audio.setTrackCompleteCallback(() => {
  if (isStopping) {
    console.log('Queue state: Track completion ignored - stopping in progress')
    return
  }
  console.log('Queue state: Track completed, playing next in queue')
  void playNextInQueue()
})

// Set up the progress callback to update UI
audio.setProgressCallback((newProgress: number) => {
  progress = newProgress
})

async function playNextInQueue(): Promise<boolean> {
  console.log('⏭️ Queue State: playNextInQueue called')
  console.log('📊 Queue State: Queue length:', queue.length)
  logger.info('Playing next track in queue', 'QueueState', { queueLength: queue.length })
  
  if (queue.length === 0) {
    console.log('⚠️ Queue State: Queue is empty, stopping audio')
    logger.info('Queue is empty, stopping audio', 'QueueState')
    await stopPlayback()
    return false
  }
  
  const nextTrack = queue.shift() || null
  console.log('🎵 Queue State: Next track from queue:', nextTrack)
  logger.info('Next track from queue', 'QueueState', { track: nextTrack })
  
  if (!nextTrack) {
    console.log('⚠️ Queue State: No next track, stopping audio')
    logger.info('No next track, stopping audio', 'QueueState')
    await stopPlayback()
    return false
  }
  
  currentTrack = nextTrack
  console.log('🎯 Queue State: Set current track:', currentTrack)
  logger.info('Set current track', 'QueueState', { track: currentTrack })
  saveState()
  
  // Re-enable the track completion callback when playing next track
  audio.setTrackCompleteCallback(() => {
    logger.info('Queue state: Track completed, playing next in queue', 'QueueState')
    void playNextInQueue()
  })
  
  console.log('🚀 Queue State: Calling audio.playFile with path:', nextTrack.path)
  logger.info('Playing file', 'QueueState', { filePath: nextTrack.path })
  const success = await audio.playFile(nextTrack.path)
  console.log('📊 Queue State: Play file result:', success)
  logger.info('Play file result', 'QueueState', { success, filePath: nextTrack.path })
  
  if (success) {
    isPlaying = true
    console.log('✅ Queue State: Set isPlaying to true')
  } else {
    console.log('❌ Queue State: Play file failed, isPlaying remains false')
  }

  // Increment play count for this track
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/playcounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackPath: nextTrack.path })
    })
  } catch (err) {
    console.error('Failed to increment play count:', err)
  }

  return success
}

async function startPlayback(): Promise<boolean> {
  if (currentTrack) {
    // Re-enable the track completion callback when starting playback
    audio.setTrackCompleteCallback(() => {
      logger.info('Queue state: Track completed, playing next in queue', 'QueueState')
      void playNextInQueue()
    })
    
    logger.info('Starting playback for current track', 'QueueState', { track: currentTrack })
    const success = await audio.playFile(currentTrack.path)
    if (success) {
      isPlaying = true
    }
    return success
  } else if (queue.length > 0) {
    logger.info('No current track, playing next in queue', 'QueueState')
    return await playNextInQueue()
  } else {
    logger.info('No tracks to play', 'QueueState')
    return false
  }
}

async function stopPlayback(): Promise<boolean> {
  // Check if we're in the process of stopping
  if (isStopping) {
    logger.info('stopPlayback: Already stopping, skipping', 'QueueState')
    return true
  }
  
  logger.info('Stopping all playback', 'QueueState')
  
  // Clear the track completion callback to prevent race conditions
  audio.clearCallbackForStop()
  
  const success = await audio.stop()
  isPlaying = false
  currentTrack = null
  progress = 0
  saveState()
  
  logger.info('stopPlayback: Completed with success: ' + success, 'QueueState')
  return success
}

async function pausePlayback(): Promise<boolean> {
  console.log('pausePlayback: Pausing playback')
  const success = await audio.pause()
  if (success) {
    isPlaying = false
  }
  return success
}

async function resumePlayback(): Promise<boolean> {
  console.log('resumePlayback: Resuming playback')
  if (currentTrack) {
    const success = await audio.resume()
    if (success) {
      isPlaying = true
    }
    return success
  } else {
    return await startPlayback()
  }
}

async function seekPlayback(position: number): Promise<boolean> {
  console.log('seekPlayback: Seeking to position:', position)
  console.log('seekPlayback: currentTrack:', currentTrack)
  console.log('seekPlayback: isPlaying:', isPlaying)
  if (!currentTrack) {
    console.error('seekPlayback: No currentTrack, cannot seek')
    return false
  }
  // Pass normalized position (0-1) to audio.seek
  const success = await audio.seek(position)
  
  // After seek, update state based on the active audio player
  if (audioFactory.getCurrentType() === 'vlc') {
    // For VLC, poll VLC for latest state
    try {
      const statusUrl = `http://localhost:8080/requests/status.xml`;
      const response = await fetch(statusUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(':jukebox').toString('base64')}`
        }
      });
      if (response.ok) {
        const statusText = await response.text();
        const stateMatch = statusText.match(/<state>([^<]+)<\/state>/);
        const state = stateMatch ? stateMatch[1] : 'unknown';
        isPlaying = state === 'playing';
        const timeMatch = statusText.match(/<time>(\d+)<\/time>/);
        const lengthMatch = statusText.match(/<length>(\d+)<\/length>/);
        if (timeMatch && lengthMatch) {
          const currentTime = parseInt(timeMatch[1], 10);
          const totalLength = parseInt(lengthMatch[1], 10);
          progress = totalLength > 0 ? currentTime / totalLength : 0;
        }
      }
    } catch (e) {
      console.error('seekPlayback: Error polling VLC for state after seek', e);
    }
  } else if (audioFactory.getCurrentType() === 'mpd') {
    // For MPD, use the audio manager's methods
    try {
      isPlaying = audio.getStatus().isPlaying;
      progress = audio.getPlaybackProgress();
    } catch (e) {
      console.error('seekPlayback: Error getting MPD state after seek', e);
    }
  }
  
  if (success) {
    console.log('seekPlayback: Seek completed, isPlaying:', isPlaying, 'progress:', progress)
  }
  return success
}

async function addToQueue(filePath: string): Promise<void> {
  console.log('🎯 Queue State: addToQueue called with path:', filePath)
  
  // Check if we're in the process of stopping
  if (isStopping) {
    console.log('⚠️ Queue State: Ignoring addToQueue - stopping in progress')
    logger.info('Ignoring addToQueue - stopping in progress', 'QueueState')
    return
  }
  
  // Generate a unique ID for the track
  const trackId = `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const track: QueueTrack = {
    id: trackId,
    path: filePath,
    title: filePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Unknown',
    artist: 'Unknown',
    album: 'Unknown',
    duration: '0:00'
  }
  queue.push(track)
  saveState()
  
  console.log('📝 Queue State: Added track to queue:', track)
  console.log('📊 Queue State: Queue length now:', queue.length)
  logger.info('Added track to queue', 'QueueState', { track, queueLength: queue.length })
  
  // If no track is currently playing, start playing this track
  if (!currentTrack && !isPlaying) {
    console.log('▶️ Queue State: No current track, starting playback...')
    logger.info('No current track, starting playback', 'QueueState')
    const success = await playNextInQueue()
    if (success) {
      console.log('✅ Queue State: Playback started successfully')
      logger.info('Playback started successfully', 'QueueState')
    } else {
      console.log('❌ Queue State: Failed to start playback')
      logger.error('Failed to start playback', 'QueueState')
    }
  } else {
    console.log('ℹ️ Queue State: Track added but not starting playback (currentTrack:', currentTrack, ', isPlaying:', isPlaying, ')')
  }
}

function getQueue(): QueueTrack[] {
  return queue
}

function getCurrentTrack(): QueueTrack | null {
  return currentTrack
}

function getIsPlaying(): boolean {
  return isPlaying
}

function getProgress(): number {
  return progress
}

function getVolume(): number {
  // Always return the current audio manager volume to ensure consistency
  return audio.getVolume()
}

async function setVolume(newVolume: number): Promise<number> {
  volume = Math.max(0, Math.min(1, newVolume))
  isMuted = volume === 0
  const actualVolumePercent = await audio.setVolume(volume)
  // Update our local volume to match the actual system volume
  volume = actualVolumePercent / 100
  return actualVolumePercent
}

function getIsMuted(): boolean {
  // Always return the current audio manager mute state to ensure consistency
  return audio.isMuted()
}

function toggleMute(): boolean {
  isMuted = !isMuted
  return audio.toggleMute()
}

async function clearQueue(): Promise<void> {
  queue = []
  await stopPlayback()
  saveState()
}

function removeFromQueue(index: number): void {
  if (index >= 0 && index < queue.length) {
    queue.splice(index, 1)
    saveState()
  }
}

function reorderQueue(fromIndex: number, toIndex: number): void {
  if (fromIndex >= 0 && fromIndex < queue.length && 
      toIndex >= 0 && toIndex < queue.length) {
    const movedTrack = queue.splice(fromIndex, 1)[0]
    queue.splice(toIndex, 0, movedTrack)
    saveState()
  }
}

// Get debug information about the current state
function getDebugInfo(): DebugInfo {
  const audioStatus = audio.getStatus()
  return {
    queueLength: queue.length,
    currentTrack,
    audioStatus,
    hasStateFile: fs.existsSync(STATE_FILE_PATH),
    stateFileSize: fs.existsSync(STATE_FILE_PATH) ? fs.statSync(STATE_FILE_PATH).size : 0
  }
}

// Helper to get current file from audio player
async function getCurrentFileFromAudioPlayer(): Promise<string | null> {
  if (audioFactory.getCurrentType() === 'vlc') {
    // For VLC, use the HTTP API
    try {
      const statusUrl = `http://localhost:8080/requests/status.xml`;
      const response = await fetch(statusUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(':jukebox').toString('base64')}`
        }
      });
      if (!response.ok) return null;
      const statusText = await response.text();
      const fileMatch = statusText.match(/<info name='filename'>([^<]+)<\/info>/);
      if (fileMatch) {
        // This is just the filename, not the full path. Try to match it to a known file in the queue.
        const filename = fileMatch[1];
        // Try to find in queue
        const found = queue.find(t => t.path.endsWith(filename));
        if (found) return found.path;
        // If not found, try currentTrack
        if (currentTrack && currentTrack.path.endsWith(filename)) return currentTrack.path;
        // Otherwise, return just the filename (not ideal, but better than nothing)
        return filename;
      }
      return null;
    } catch {
      return null;
    }
  } else if (audioFactory.getCurrentType() === 'mpd') {
    // For MPD, use the audio manager's method
    try {
      const currentSong = audio.getCurrentSong();
      return currentSong.file;
    } catch {
      return null;
    }
  }
  
  return null;
}

// Robust getCurrentState with audio player-aware sync
async function getCurrentState(): Promise<{
  isPlaying: boolean
  currentTrack: QueueTrack | null
  queue: QueueTrack[]
  progress: number
  volume: number
  isMuted: boolean
}> {
  // Only sync with VLC if VLC is the active audio player
  if (currentTrack && audioFactory.getCurrentType() === 'vlc') {
    try {
      const statusUrl = `http://localhost:8080/requests/status.xml`;
      const response = await fetch(statusUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(':jukebox').toString('base64')}`
        }
      });
      if (response.ok) {
        const statusText = await response.text();
        const stateMatch = statusText.match(/<state>([^<]+)<\/state>/);
        const state = stateMatch ? stateMatch[1] : 'unknown';
        isPlaying = state === 'playing';
        const timeMatch = statusText.match(/<time>(\d+)<\/time>/);
        const lengthMatch = statusText.match(/<length>(\d+)<\/length>/);
        if (timeMatch && lengthMatch) {
          const currentTime = parseInt(timeMatch[1], 10);
          const totalLength = parseInt(lengthMatch[1], 10);
          progress = totalLength > 0 ? currentTime / totalLength : 0;
        }
      }
    } catch (error) {
      // If VLC is unreachable, keep current state
      console.error('getCurrentState: Error syncing with VLC:', error);
    }
  } else if (currentTrack && audioFactory.getCurrentType() === 'mpd') {
    // For MPD, use the audio manager's methods instead of trying to connect to VLC
    try {
      isPlaying = audio.getStatus().isPlaying;
      progress = audio.getPlaybackProgress();
    } catch (error) {
      console.error('getCurrentState: Error getting MPD state:', error);
    }
  }
  
  return {
    isPlaying,
    currentTrack,
    queue,
    progress,
    volume: audio.getVolume(), // Always get the current audio manager volume
    isMuted: audio.isMuted() // Always get the current audio manager mute state
  };
}

const queueState: QueueStateInterface = {
  getQueue,
  getCurrentTrack,
  addToQueue,
  getIsPlaying,
  playNextInQueue,
  clearCurrentTrack: async () => { await stopPlayback(); },
  clearQueue,
  removeFromQueue,
  reorderQueue,
  checkAudioState: async () => {}, // No auto-recovery
  saveState,
  loadState,
  getDebugInfo,
  audio,
  switchAudioPlayer,
  reloadAudioPlayerPreference,
  stopAllPlayback: async () => { 
    logger.info('stopAllPlayback: Starting stop operation', 'QueueState')
    
    // Use the proper audio manager stop method instead of killing processes
    try {
      await audio.stop()
      logger.info('stopAllPlayback: Audio manager stop completed', 'QueueState')
    } catch (error) {
      logger.error('stopAllPlayback: Error stopping audio manager', 'QueueState', error)
    }
    
    // Clear the track completion callback completely
    audio.clearTrackCompleteCallback()
    logger.info('stopAllPlayback: Cleared track completion callback', 'QueueState')
    
    // Reset all state
    currentTrack = null
    isPlaying = false
    progress = 0
    isStopping = false
    saveState()
    logger.info('stopAllPlayback: Reset all state, kept queue intact', 'QueueState')
    
    logger.info('stopAllPlayback: Stop operation completed', 'QueueState')
  },
  skipToNext: async () => {
    if (queue.length === 0) {
      logger.info('Queue is empty, cannot skip', 'QueueState')
      return false
    }
    
    // Get the next track without removing it from the queue yet
    const nextTrack = queue[0]
    logger.info('Skipping to next track', 'QueueState', { track: nextTrack })
    
    // Stop current playback first
    await stopPlayback()
    
    // Now remove the current track and set the next one
    queue.shift()
    currentTrack = nextTrack
    isPlaying = false
    progress = 0
    saveState()
    
    // Start playing the next track
    logger.info('Playing skipped track', 'QueueState', { filePath: nextTrack.path })
    
    // Re-enable the track completion callback
    audio.setTrackCompleteCallback(() => {
      logger.info('Queue state: Track completed, playing next in queue', 'QueueState')
      void playNextInQueue()
    })
    
    const success = await audio.playFile(nextTrack.path)
    if (success) {
      isPlaying = true
    }
    
    // Increment play count for this track
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/playcounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackPath: nextTrack.path })
      })
    } catch (err) {
      console.error('Failed to increment play count:', err)
    }
    
    return success
  },
  getProgress,
  getVolume,
  setVolume,
  getIsMuted,
  toggleMute,
  seekPlayback,
  getCurrentState
}

export default queueState 