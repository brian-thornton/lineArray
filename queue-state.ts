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
      console.log('🔍 Queue State: Raw settings.audioPlayer:', settings.audioPlayer, 'Type:', typeof settings.audioPlayer)
      console.log('🔍 Queue State: Validation array:', ['vlc', 'afplay'])
      console.log('🔍 Queue State: Includes check result:', settings.audioPlayer ? ['vlc', 'afplay'].includes(settings.audioPlayer) : 'undefined')
      
      if (settings.audioPlayer && ['vlc', 'afplay'].includes(settings.audioPlayer)) {
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

// Function to load playEntireQueue setting from settings
function loadPlayEntireQueueSetting(): boolean {
  try {
    const settingsPath = path.join(process.cwd(), 'data', 'settings.json')
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8')
      const settings = JSON.parse(data) as { playEntireQueue?: boolean }
      console.log('🔍 Queue State: Loaded playEntireQueue setting:', settings.playEntireQueue)
      return settings.playEntireQueue ?? false
    }
  } catch (error) {
    console.error('💥 Queue State: Error loading playEntireQueue setting:', error)
    logger.error('Queue state: Error loading playEntireQueue setting, using default', 'QueueState', error)
  }
  
  console.log('🎬 Queue State: Using default playEntireQueue setting: false')
  return false
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

// Queue monitoring function - continuously checks for new tracks and starts playback
function monitorQueueForNewTracks(): void {
  const state = getStateSnapshot()
  
  // Only start playback if there's no current track and no playback happening
  if (!state.currentTrack && !state.isPlaying && state.queueLength > 0) {
    console.log('🎯 Queue State: Queue monitor detected new tracks, starting playback...')
    logger.info('Queue monitor detected new tracks, starting playback', 'QueueState')
    void playNextInQueue()
  } else if (state.currentTrack && state.isPlaying) {
    // Only log playing state occasionally to avoid spam (10% chance)
    if (Math.random() < 0.1) {
      console.log('🎯 Queue State: Queue monitor - track currently playing:', state.currentTrack.path)
    }
  } else if (state.currentTrack && !state.isPlaying) {
    // Only log paused state occasionally to avoid spam (10% chance)
    if (Math.random() < 0.1) {
      console.log('🎯 Queue State: Queue monitor - track paused:', state.currentTrack.path)
    }
  }
  // Don't log idle state - it's the most common and creates noise
}

// Manual queue check function that can be called to force a check
function checkQueueAndStartPlayback(): void {
  const state = getStateSnapshot()
  console.log('🎯 Queue State: Manual queue check triggered')
  console.log('🎯 Queue State: Current state - currentTrack:', state.currentTrack?.path || 'null', ', isPlaying:', state.isPlaying, ', queue length:', state.queueLength)
  
  // Get the actual audio manager state for comparison
  try {
    const actualIsPlaying = getIsPlaying()
    console.log('🎯 Queue State: Audio manager state - actualIsPlaying:', actualIsPlaying)
  } catch (error) {
    console.error('🎯 Queue State: Error getting audio manager state:', error)
  }
  
  if (!state.currentTrack && !state.isPlaying && state.queueLength > 0) {
    console.log('🎯 Queue State: Manual check detected new tracks, starting playback...')
    logger.info('Manual queue check detected new tracks, starting playback', 'QueueState')
    void playNextInQueue()
  } else {
    console.log('🎯 Queue State: Manual check - no action needed')
    console.log('🎯 Queue State: Condition breakdown:')
    console.log('  - !currentTrack:', !state.currentTrack)
    console.log('  - !isPlaying:', !state.isPlaying)
    console.log('  - queue.length > 0:', state.queueLength > 0)
  }
}

// Monitor queue every 5 seconds for new tracks (reduced frequency to reduce log noise)
setInterval(monitorQueueForNewTracks, 5000)

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

// Ensure we're using the correct audio player type
if (audioFactory.getCurrentType() !== preferredAudioPlayer) {
  console.log('⚠️ Queue State: Audio player type mismatch, switching to:', preferredAudioPlayer)
  audio = audioFactory.createManager(preferredAudioPlayer)
}

// Helper function to always get the current audio manager from the factory
function getCurrentAudioManager(): AudioManagerInterface {
  const currentManager = audioFactory.getCurrentManager()
  if (!currentManager) {
    console.error('❌ Queue State: No current audio manager available')
    throw new Error('No audio manager available')
  }
  return currentManager
}

// Update the local audio variable to always point to the current manager
function updateLocalAudioReference(): void {
  try {
    audio = getCurrentAudioManager()
    console.log('🔄 Queue State: Updated local audio reference to:', audio.constructor.name)
  } catch (error) {
    console.error('❌ Queue State: Failed to update local audio reference:', error)
  }
}

let queue: QueueTrack[] = []
let currentTrack: QueueTrack | null = null
let isPlaying: boolean = false
let progress: number = 0
let volume: number = 1.0
let isMuted: boolean = false
let isStopping: boolean = false

// State lock to prevent race conditions
let isStateUpdating: boolean = false


// File path for persisting queue state
const STATE_FILE_PATH = path.join(process.cwd(), 'data', 'queue-state.json')

// Safe state update function to prevent race conditions
function safeStateUpdate(updater: () => void): void {
  if (isStateUpdating) {
    console.log('⚠️ Queue State: State update blocked - another update in progress')
    return
  }
  
  isStateUpdating = true
  try {
    updater()
  } finally {
    isStateUpdating = false
  }
}

// Get a consistent snapshot of the current state
function getStateSnapshot(): { currentTrack: QueueTrack | null; isPlaying: boolean; queueLength: number } {
  return {
    currentTrack,
    isPlaying,
    queueLength: queue.length
  }
}

// Log state changes for debugging
function logStateChange(operation: string, oldState: { currentTrack: QueueTrack | null; isPlaying: boolean; queueLength: number }): void {
  const newState = getStateSnapshot()
  console.log('🔄 Queue State: State change detected')
  console.log('  Operation:', operation)
  console.log('  Old state:', oldState)
  console.log('  New state:', newState)
  
  // Check for suspicious state changes
  if (oldState.currentTrack && !newState.currentTrack && newState.queueLength > 0) {
    console.log('⚠️ Queue State: WARNING - currentTrack cleared but queue has tracks!')
  }
  if (oldState.queueLength !== newState.queueLength) {
    console.log('📊 Queue State: Queue length changed from', oldState.queueLength, 'to', newState.queueLength)
  }
}

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
      logger.info('Queue state: Killing all VLC processes before switching to AFPLAY', 'QueueState')
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

// NOTE: Track completion callbacks are now set up per-track in playNextInQueue
// This allows us to control auto-advance behavior on a per-track basis

// Set up the progress callback to update UI
getCurrentAudioManager().setProgressCallback((newProgress: number) => {
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
  
  const nextTrack = queue[0] || null
  console.log('🎵 Queue State: Next track from queue:', nextTrack)
  logger.info('Next track from queue', 'QueueState', { track: nextTrack })
  
  if (!nextTrack) {
    console.log('⚠️ Queue State: No next track, stopping audio')
    logger.info('No next track, stopping audio', 'QueueState')
    await stopPlayback()
    return false
  }
  
  // Remove the current track from the queue before playing it
  queue.shift() // Remove the first track from the queue
  console.log('📊 Queue State: Removed track from queue, remaining length:', queue.length)
  
  // Don't call stopPlayback() here - just update the state
  // This preserves the callback for the next track
  console.log('🎯 Queue State: Setting current track:', nextTrack)
  logger.info('Set current track', 'QueueState', { track: nextTrack })
  
  currentTrack = nextTrack
  isPlaying = false
  progress = 0
  saveState()
  
  // Re-enable the track completion callback when playing next track
  updateLocalAudioReference() // Ensure we have the current audio manager
  console.log('🎯 Queue State: Setting up track completion callback for next track')
  
  // Check if there are more tracks in the queue to determine auto-advance behavior
  const shouldAutoAdvance = queue.length > 0 // Check remaining tracks after removing current one
  if (shouldAutoAdvance) {
    audio.setTrackCompleteCallback(() => {
      console.log('🎯 Queue State: Track completion callback triggered - auto-advancing to next track')
      logger.info('Queue state: Track completed, auto-advancing to next track', 'QueueState')
      void playNextInQueue()
    })
  } else {
    console.log('🎯 Queue State: Setting up completion callback for last track to reset state')
    // For the last track in queue, set a callback that resets the state when complete
    audio.setTrackCompleteCallback(() => {
      console.log('🎯 Queue State: Last track completed, resetting state')
      logger.info('Last track completed, resetting state', 'QueueState')
      // Reset state for last track completion
      currentTrack = null
      isPlaying = false
      progress = 0
      saveState()
      console.log('🎯 Queue State: State reset complete - currentTrack: null, isPlaying: false')
    })
  }
  
  console.log('🚀 Queue State: Calling audio.playFile with path:', nextTrack.path)
  logger.info('Playing file', 'QueueState', { filePath: nextTrack.path })
  
  try {
    const currentAudioManager = audioFactory.getCurrentManager();
    console.log('🎯 Queue State: Got audio manager:', currentAudioManager?.constructor.name)
    
    if (currentAudioManager) {
      console.log('🎯 Queue State: About to call playFile on:', nextTrack.path)
      const success = await currentAudioManager.playFile(nextTrack.path)
      
      console.log('📊 Queue State: Play file result:', success)
      logger.info('Play file result', 'QueueState', { success, filePath: nextTrack.path })
      
      if (success) {
        isPlaying = true
        console.log('✅ Queue State: Set isPlaying to true')
        // Only remove the track from queue after successful playback
        queue.shift()
        console.log('🎯 Queue State: Removed track from queue, remaining tracks:', queue.length)
      } else {
        console.log('❌ Queue State: Play file failed, isPlaying remains false')
        // Don't remove the track from queue if playback failed
        console.log('⚠️ Queue State: Track remains in queue for retry')
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
    } else {
      console.error('playNextInQueue: No current audio manager available');
      return false
    }
  } catch (error) {
    console.error('playNextInQueue: Error playing file:', error);
    return false
  }
}

async function startPlayback(): Promise<boolean> {
  if (currentTrack) {
    // Check if there are more tracks in the queue to determine auto-advance behavior
    const shouldAutoAdvance = queue.length > 0
    if (shouldAutoAdvance) {
      // Re-enable the track completion callback when starting playback
      audio.setTrackCompleteCallback(() => {
        logger.info('Queue state: Track completed, auto-advancing to next track', 'QueueState')
        void playNextInQueue()
      })
    } else {
      console.log('🎯 Queue State: Setting up completion callback for single track in startPlayback to reset state')
      // For single tracks, set a callback that resets the state when complete
      audio.setTrackCompleteCallback(() => {
        console.log('🎯 Queue State: Single track completed in startPlayback, resetting state')
        logger.info('Single track completed in startPlayback, resetting state', 'QueueState')
        // Reset state for single track completion
        currentTrack = null
        isPlaying = false
        progress = 0
        saveState()
        console.log('🎯 Queue State: State reset complete in startPlayback - currentTrack: null, isPlaying: false')
      })
    }
    
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
  
  // Force reset all state to ensure consistency
  isPlaying = false
  currentTrack = null
  progress = 0
  
  // Force reset the audio manager state to match
  try {
    audio.forceResetState()
    console.log('🎯 Queue State: Forced audio manager state reset')
  } catch (error) {
    console.error('🎯 Queue State: Error resetting audio manager state:', error)
  }
  
  // Log the state after reset for debugging
  logger.info('stopPlayback: State reset - isPlaying: false, currentTrack: null, progress: 0', 'QueueState')
  
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
    try {
      const currentAudioManager = audioFactory.getCurrentManager();
      if (currentAudioManager) {
        const success = await currentAudioManager.resume()
        if (success) {
          isPlaying = true
        }
        return success
      } else {
        console.error('resumePlayback: No current audio manager available');
        return false
      }
    } catch (error) {
      console.error('resumePlayback: Error resuming playback:', error);
      return false
    }
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
  try {
    const currentAudioManager = audioFactory.getCurrentManager();
    if (currentAudioManager) {
      const success = await currentAudioManager.seek(position)
      
      // After seek, update state based on the active audio player
      if (audioFactory.getCurrentType() === 'vlc') {
        // For VLC, poll VLC for latest state
        try {
          const statusUrl = `http://localhost:8081/requests/status.xml`;
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
      } else if (audioFactory.getCurrentType() === 'afplay') {
        // For AFPLAY, use the audio manager's methods
        try {
          isPlaying = currentAudioManager.getStatus().isPlaying;
          progress = currentAudioManager.getPlaybackProgress();
        } catch (e) {
          console.error('seekPlayback: Error getting AFPLAY state after seek', e);
        }
      }
      
      if (success) {
        console.log('seekPlayback: Seek completed, isPlaying:', isPlaying, 'progress:', progress)
      }
      return success
    } else {
      console.error('seekPlayback: No current audio manager available');
      return false
    }
  } catch (error) {
    console.error('seekPlayback: Error during seek:', error);
    return false
  }
  
  }

async function addToQueue(filePath: string, isAlbum: boolean = false): Promise<void> {
  console.log('🎯 Queue State: addToQueue called with path:', filePath, ', isAlbum:', isAlbum)
  console.log('🎯 Queue State: Current state - currentTrack:', currentTrack?.path || 'null', ', isPlaying:', isPlaying, ', queue length before:', queue.length)
  
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
    duration: '0:00',
    isAlbum
  }
  queue.push(track)
  saveState()
  
  console.log('📝 Queue State: Added track to queue:', track)
  console.log('📊 Queue State: Queue length now:', queue.length)
  console.log('🎯 Queue State: Queue state after adding track - currentTrack:', currentTrack?.path || 'null', ', isPlaying:', isPlaying)
  logger.info('Added track to queue', 'QueueState', { track, queueLength: queue.length })
  
  // If no track is currently playing, start playing this track
  // Only check the queue state - if there's no currentTrack, we should start playback
  const hasCurrentTrack = currentTrack !== null
  
  console.log('🎯 Queue State: Playback decision - hasCurrentTrack:', hasCurrentTrack, ', queue length:', queue.length)
  
  if (!hasCurrentTrack) {
    console.log('▶️ Queue State: No current track, starting playback...')
    console.log('🎯 Queue State: About to call playNextInQueue()')
    logger.info('No current track, starting playback', 'QueueState')
    
    // Force reset audio manager state to ensure it's ready to play
    try {
      console.log('🎯 Queue State: Force resetting audio manager state')
      audio.clearCallbackForStop()
      // Small delay to ensure audio manager is ready
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.error('💥 Queue State: Error resetting audio manager:', error)
    }
    
    try {
      const success = await playNextInQueue()
      console.log('🎯 Queue State: playNextInQueue() returned:', success)
      
      if (success) {
        console.log('✅ Queue State: Playback started successfully')
        logger.info('Playback started successfully', 'QueueState')
      } else {
        console.log('❌ Queue State: Failed to start playback')
        logger.error('Failed to start playback', 'QueueState')
      }
    } catch (error) {
      console.error('💥 Queue State: Error calling playNextInQueue():', error)
      logger.error('Error calling playNextInQueue', 'QueueState', error)
    }
  } else {
    console.log('ℹ️ Queue State: Track added but not starting playback (currentTrack:', currentTrack?.path, ')')
    // Even if there's a current track, the monitor will pick up new tracks in the queue
    console.log('ℹ️ Queue State: Queue monitor will handle additional tracks automatically')
  }
  
  // Force an immediate queue check to ensure playback starts if possible
  console.log('🎯 Queue State: Forcing immediate queue check after adding track')
  setTimeout(() => {
    console.log('🎯 Queue State: Executing delayed queue check')
    checkQueueAndStartPlayback()
  }, 100)
}

function getQueue(): QueueTrack[] {
  return queue
}

function getCurrentTrack(): QueueTrack | null {
  return currentTrack
}

function getIsPlaying(): boolean {
  // Always check the actual audio manager status to ensure consistency
  try {
    const currentAudioManager = audioFactory.getCurrentManager();
    if (currentAudioManager) {
      const audioStatus = currentAudioManager.getStatus();
      const result = audioStatus.isPlaying;
      console.log('🎯 Queue State: getIsPlaying() - audioStatus.isPlaying:', result, ', local isPlaying:', isPlaying)
      return result;
    } else {
      console.error('getIsPlaying: No current audio manager available');
      return isPlaying;
    }
  } catch (error) {
    console.error('Error getting audio status, falling back to local state:', error)
    return isPlaying
  }
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

async function toggleMute(): Promise<boolean> {
  const result = await audio.toggleMute()
  isMuted = result
  return result
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
      const statusUrl = `http://localhost:8081/requests/status.xml`;
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
  } else if (audioFactory.getCurrentType() === 'afplay') {
  // For AFPLAY, use the audio manager's method
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
      const statusUrl = `http://localhost:8081/requests/status.xml`;
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
  } else if (currentTrack && audioFactory.getCurrentType() === 'afplay') {
    // For AFPLAY, use the audio manager's methods instead of trying to connect to VLC
    try {
      const currentAudioManager = audioFactory.getCurrentManager();
      if (currentAudioManager) {
        const audioStatus = currentAudioManager.getStatus();
        isPlaying = audioStatus.isPlaying;
        progress = currentAudioManager.getPlaybackProgress();
      } else {
        console.error('getCurrentState: No current audio manager available');
      }
    } catch (error) {
      console.error('getCurrentState: Error getting AFPLAY state:', error);
      // Fallback to stored state if audio manager fails
      // Don't change isPlaying or progress, keep current values
    }
  }
  
  return {
    isPlaying,
    currentTrack,
    queue,
    progress,
    volume: (() => {
      try {
        return audio.getVolume();
      } catch (error) {
        console.error('getCurrentState: Error getting volume:', error);
        return volume; // Fallback to stored volume
      }
    })(),
    isMuted: (() => {
      try {
        return audio.isMuted();
      } catch (error) {
        console.error('getCurrentState: Error getting mute state:', error);
        return isMuted; // Fallback to stored mute state
      }
    })()
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
  checkQueueAndStartPlayback,
  stopAllPlayback: async () => { 
    logger.info('stopAllPlayback: Starting stop operation', 'QueueState')
    
    // Set stopping flag to prevent race conditions
    isStopping = true
    
    // Use the aggressive force stop method to ensure VLC actually stops
    try {
      await audio.forceStop()
      logger.info('stopAllPlayback: Audio manager force stop completed', 'QueueState')
      
      // Verify that VLC actually stopped
      try {
        const audioStatus = audio.getStatus()
        console.log('🎯 Queue State: VLC status after stop:', audioStatus)
        if (audioStatus.isPlaying) {
          console.log('⚠️ Queue State: WARNING - VLC still reports as playing after stop!')
        }
      } catch (error) {
        console.log('🎯 Queue State: Could not verify VLC status after stop')
      }
    } catch (error) {
      logger.error('stopAllPlayback: Error stopping audio manager', 'QueueState', error)
    }
    
    // Clear the track completion callback completely
    audio.clearTrackCompleteCallback()
    logger.info('stopAllPlayback: Cleared track completion callback', 'QueueState')
    
    // Clear the queue to prevent auto-advance
    queue = []
    logger.info('stopAllPlayback: Cleared queue to prevent auto-advance', 'QueueState')
    
    // Reset all state
    currentTrack = null
    isPlaying = false
    progress = 0
    isStopping = false
    saveState()
    logger.info('stopAllPlayback: Reset all state and cleared queue', 'QueueState')
    
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
    console.log('🎯 Queue State: Setting up track completion callback for skipped track')
    audio.setTrackCompleteCallback(() => {
      console.log('🎯 Queue State: Track completion callback triggered for skipped track')
      logger.info('Queue state: Track completed, playing next in queue', 'QueueState')
      void playNextInQueue()
    })
    
    const success = await audio.playFile(nextTrack.path)
    if (success) {
      isPlaying = true
      
      // Mark this track as skipped to enable extra completion protection
      // This prevents the aggressive completion detection from racing through the queue
      if (audio.markAsSkipped) {
        audio.markAsSkipped()
      }
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