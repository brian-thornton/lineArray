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
// (global dedup handled below with __audioPreferenceInterval)

// Queue monitoring function - continuously checks for new tracks and starts playback
function monitorQueueForNewTracks(): void {
  const state = getStateSnapshot()

  // Only start playback if:
  // - no track is currently playing or loading
  // - there are tracks in the queue
  // - the user hasn't manually stopped
  if (
    !state.currentTrack &&
    !state.isPlaying &&
    !qs.playbackInProgress &&
    state.queueLength > 0 &&
    !qs.manuallyStoppedByUser
  ) {
    console.log('🎯 Queue State: monitor → starting playback')
    void playNextInQueue()
  }
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
  
  if (!state.currentTrack && !state.isPlaying && state.queueLength > 0 && !qs.manuallyStoppedByUser) {
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
// Use global object so that multiple module instances (from Next.js hot-reload) don't
// create duplicate intervals — each new instance clears the previous one first.
const _g = global as typeof globalThis & {
  __queueMonitorInterval?: NodeJS.Timeout
  __audioPreferenceInterval?: NodeJS.Timeout
}
if (_g.__queueMonitorInterval) clearInterval(_g.__queueMonitorInterval)
_g.__queueMonitorInterval = setInterval(monitorQueueForNewTracks, 1000)

if (_g.__audioPreferenceInterval) clearInterval(_g.__audioPreferenceInterval)
_g.__audioPreferenceInterval = setInterval(checkAndReloadAudioPlayerPreference, 30000)

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

// ─── Shared global state ──────────────────────────────────────────────────────
// Next.js dev-mode creates separate module instances per API route. To ensure
// all instances share the same queue/playback state, we store everything in the
// global object and reference it via `qs`.
interface QS {
  queue: QueueTrack[]
  currentTrack: QueueTrack | null
  isPlaying: boolean
  progress: number
  isStopping: boolean
  manuallyStoppedByUser: boolean
  playbackStartTimer: NodeJS.Timeout | null
  // Concurrency control:
  // playbackGeneration is incremented every time we start a new playback or stop.
  // Each playNextInQueue() call captures its generation at start; after any await it
  // checks if its generation is still current — if not, it was cancelled and aborts.
  playbackGeneration: number
  // playbackInProgress is true while playNextInQueue() is executing.
  // Prevents concurrent calls from each shifting a track off the queue.
  playbackInProgress: boolean
}
const _gqs = global as typeof globalThis & { __qs?: QS }
if (!_gqs.__qs) {
  _gqs.__qs = {
    queue: [],
    currentTrack: null,
    isPlaying: false,
    progress: 0,
    isStopping: false,
    manuallyStoppedByUser: false,
    playbackStartTimer: null,
    playbackGeneration: 0,
    playbackInProgress: false,
  }
}
const qs = _gqs.__qs
// ─────────────────────────────────────────────────────────────────────────────

let volume: number = 1.0
let isMuted: boolean = false


// File path for persisting queue state
const STATE_FILE_PATH = path.join(process.cwd(), 'data', 'queue-state.json')

// Get a consistent snapshot of the current state
function getStateSnapshot(): { currentTrack: QueueTrack | null; isPlaying: boolean; queueLength: number } {
  return {
    currentTrack: qs.currentTrack,
    isPlaying: qs.isPlaying,
    queueLength: qs.queue.length
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
      queue: qs.queue,
      currentTrack: qs.currentTrack,
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
        qs.queue = state.queue
        qs.currentTrack = state.currentTrack
        console.log('Queue state restored from:', STATE_FILE_PATH)
        console.log('Restored queue length:', qs.queue.length)
        console.log('Restored current track:', qs.currentTrack)
      } else {
        console.log('Queue state is too old or invalid, starting fresh')
      }
    }
  } catch (error) {
    console.error('Error loading queue state:', error)
  }
}

// Load state on module initialization — only if not already initialized by another instance
if (qs.queue.length === 0 && !qs.currentTrack) {
  loadState()
}

// Function to switch audio player
async function switchAudioPlayer(playerType: AudioPlayerType): Promise<void> {
  try {
    logger.info('Queue state: Switching audio player to: ' + playerType, 'QueueState')
    
    // Stop current playback if any
    if (qs.isPlaying) {
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
      if (qs.isStopping) {
        logger.info('Queue state: Track completion ignored - stopping in progress', 'QueueState')
        return
      }
      logger.info('Queue state: Track completed, playing next in queue', 'QueueState')
      void playNextInQueue()
    })

    audio.setProgressCallback((newProgress: number) => {
      qs.progress = newProgress
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
  qs.progress = newProgress
})

async function playNextInQueue(): Promise<boolean> {
  // ── Step 1: Claim this playback slot ────────────────────────────────────────
  // Increment the generation FIRST (synchronous, before any await).
  // Any previously in-flight playNextInQueue will see a stale generation on its
  // next await and abort without touching the queue or VLC state.
  const myGen = ++qs.playbackGeneration
  qs.manuallyStoppedByUser = false

  console.log(`⏭️ Queue State: playNextInQueue called (gen=${myGen}), queue=${qs.queue.length}`)

  // ── Step 2: Wait for previous call to release the lock ──────────────────────
  // If another playNextInQueue is loading, wait for it to detect the new generation
  // and abort (it clears playbackInProgress in its finally block).
  if (qs.playbackInProgress) {
    console.log('⏳ Queue State: waiting for previous playback to abort...')
    const deadline = Date.now() + 800
    while (qs.playbackInProgress && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 30))
    }
    if (qs.playbackInProgress) {
      console.log('⚠️ Queue State: previous playback did not abort in time, forcing flag clear')
      qs.playbackInProgress = false
    }
  }

  // After waiting, verify we're still the current generation.
  // A stop or a third skip may have superseded us while we waited.
  if (myGen !== qs.playbackGeneration) {
    console.log(`🚫 Queue State: gen ${myGen} superseded by ${qs.playbackGeneration}, aborting`)
    return false
  }

  // ── Step 3: Acquire lock ────────────────────────────────────────────────────
  qs.playbackInProgress = true

  try {
    if (qs.queue.length === 0) {
      console.log('⚠️ Queue State: Queue empty, stopping audio')
      qs.currentTrack = null
      qs.isPlaying = false
      saveState()
      return false
    }

    // ── Step 4: Shift next track (we hold the lock — no other call can do this) ─
    const nextTrack = qs.queue.shift()!
    console.log(`🎵 Queue State: Playing "${nextTrack.title}", ${qs.queue.length} remaining`)

    qs.currentTrack = nextTrack
    qs.isPlaying = false
    qs.progress = 0
    saveState()

    // ── Step 5: Set up completion callback with generation guard ────────────────
    updateLocalAudioReference()
    const currentAudioManager = audioFactory.getCurrentManager()
    if (!currentAudioManager) {
      console.error('playNextInQueue: no audio manager')
      return false
    }

    // Clear old callback synchronously — prevents the completion interval from
    // firing the previous track's callback while we're between tracks.
    currentAudioManager.clearTrackCompleteCallback()

    currentAudioManager.setTrackCompleteCallback(() => {
      // Only advance if this callback belongs to the current playback generation.
      if (myGen !== qs.playbackGeneration) {
        console.log(`🚫 Queue State: stale completion callback (gen ${myGen} vs ${qs.playbackGeneration}), ignoring`)
        return
      }
      console.log('🎯 Queue State: track complete → advancing queue')
      void playNextInQueue()
    })

    // ── Step 6: Start playback ──────────────────────────────────────────────────
    console.log(`🚀 Queue State: playFile (gen=${myGen}): ${nextTrack.path}`)
    const success = await currentAudioManager.playFile(nextTrack.path)

    // ── Step 7: Post-await generation check ────────────────────────────────────
    // After the await, verify nothing cancelled us (stop or a newer skip).
    if (myGen !== qs.playbackGeneration) {
      console.log(`🚫 Queue State: gen ${myGen} cancelled during playFile, re-stopping VLC`)
      // playFile's own _stoppedDuringLoad guard should have stopped VLC already,
      // but send another stop to be certain.
      void currentAudioManager.forceStop()
      qs.isPlaying = false
      return false
    }

    if (success) {
      qs.isPlaying = true
      console.log(`✅ Queue State: playback started (gen=${myGen})`)
    } else {
      console.log('❌ Queue State: playFile returned false')
    }

    // Record play count (fire-and-forget, don't await)
    void fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/playcounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackPath: nextTrack.path })
    }).catch(() => {}) // ignore errors

    return success
  } catch (error) {
    console.error('playNextInQueue: error:', error)
    return false
  } finally {
    // Release lock only if we're still the current generation.
    // If we were cancelled, the new owner will manage the flag.
    if (myGen === qs.playbackGeneration) {
      qs.playbackInProgress = false
    }
  }
}

async function startPlayback(): Promise<boolean> {
  if (qs.currentTrack) {
    // Always advance: playNextInQueue handles empty-queue case via stopPlayback()
    audio.setTrackCompleteCallback(() => {
      logger.info('Queue state: Track completed, advancing to next track', 'QueueState')
      void playNextInQueue()
    })

    logger.info('Starting playback for current track', 'QueueState', { track: qs.currentTrack })
    const success = await audio.playFile(qs.currentTrack.path)
    if (success) {
      qs.isPlaying = true
    }
    return success
  } else if (qs.queue.length > 0) {
    logger.info('No current track, playing next in queue', 'QueueState')
    return await playNextInQueue()
  } else {
    logger.info('No tracks to play', 'QueueState')
    return false
  }
}

async function stopPlayback(): Promise<boolean> {
  // Check if we're in the process of stopping
  if (qs.isStopping) {
    logger.info('stopPlayback: Already stopping, skipping', 'QueueState')
    return true
  }

  logger.info('Stopping all playback', 'QueueState')

  // Clear the track completion callback to prevent race conditions
  audio.clearCallbackForStop()

  const success = await audio.stop()

  // Force reset all state to ensure consistency
  qs.isPlaying = false
  qs.currentTrack = null
  qs.progress = 0
  
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
    qs.isPlaying = false
  }
  return success
}

async function resumePlayback(): Promise<boolean> {
  console.log('resumePlayback: Resuming playback')
  if (qs.currentTrack) {
    try {
      const currentAudioManager = audioFactory.getCurrentManager();
      if (currentAudioManager) {
        const success = await currentAudioManager.resume()
        if (success) {
          qs.isPlaying = true
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
  console.log('seekPlayback: currentTrack:', qs.currentTrack)
  console.log('seekPlayback: isPlaying:', qs.isPlaying)
  if (!qs.currentTrack) {
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
            qs.isPlaying = state === 'playing';
            const timeMatch = statusText.match(/<time>(\d+)<\/time>/);
            const lengthMatch = statusText.match(/<length>(\d+)<\/length>/);
            if (timeMatch && lengthMatch) {
              const currentTime = parseInt(timeMatch[1], 10);
              const totalLength = parseInt(lengthMatch[1], 10);
              qs.progress = totalLength > 0 ? currentTime / totalLength : 0;
            }
          }
        } catch (e) {
          console.error('seekPlayback: Error polling VLC for state after seek', e);
        }
      } else if (audioFactory.getCurrentType() === 'afplay') {
        // For AFPLAY, use the audio manager's methods
        try {
          qs.isPlaying = currentAudioManager.getStatus().isPlaying;
          qs.progress = currentAudioManager.getPlaybackProgress();
        } catch (e) {
          console.error('seekPlayback: Error getting AFPLAY state after seek', e);
        }
      }

      if (success) {
        console.log('seekPlayback: Seek completed, isPlaying:', qs.isPlaying, 'progress:', qs.progress)
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

// Debounced playback start — coalesces multiple rapid addToQueue calls so only
// ONE playNextInQueue() fires after all tracks have been added to the array.
function schedulePlaybackStart(): void {
  if (qs.manuallyStoppedByUser || qs.currentTrack || qs.isPlaying || qs.playbackInProgress) return
  if (qs.playbackStartTimer) clearTimeout(qs.playbackStartTimer)
  qs.playbackStartTimer = setTimeout(() => {
    qs.playbackStartTimer = null
    if (!qs.currentTrack && !qs.isPlaying && !qs.playbackInProgress && qs.queue.length > 0 && !qs.manuallyStoppedByUser) {
      console.log('▶️ Queue State: schedulePlaybackStart firing playNextInQueue')
      void playNextInQueue()
    }
  }, 150)
}

async function addToQueue(filePath: string, isAlbum: boolean = false): Promise<void> {
  if (qs.isStopping) return

  // User explicitly added a track — clear the manual-stop flag so the scheduler
  // will auto-start if nothing is currently playing.
  qs.manuallyStoppedByUser = false

  const track: QueueTrack = {
    id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    path: filePath,
    title: filePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Unknown',
    artist: 'Unknown',
    album: 'Unknown',
    duration: '0:00',
    isAlbum
  }
  qs.queue.push(track)
  saveState()
  logger.info('Added track to queue', 'QueueState', { track, queueLength: qs.queue.length })

  // Schedule a single debounced playback start — handles rapid album adds correctly
  schedulePlaybackStart()
}

function getQueue(): QueueTrack[] {
  return qs.queue
}

function getCurrentTrack(): QueueTrack | null {
  return qs.currentTrack
}

function getIsPlaying(): boolean {
  // Always check the actual audio manager status to ensure consistency
  try {
    const currentAudioManager = audioFactory.getCurrentManager();
    if (currentAudioManager) {
      const audioStatus = currentAudioManager.getStatus();
      const result = audioStatus.isPlaying;
      console.log('🎯 Queue State: getIsPlaying() - audioStatus.isPlaying:', result, ', local isPlaying:', qs.isPlaying)
      return result;
    } else {
      console.error('getIsPlaying: No current audio manager available');
      return qs.isPlaying;
    }
  } catch (error) {
    console.error('Error getting audio status, falling back to local state:', error)
    return qs.isPlaying
  }
}

function getProgress(): number {
  return qs.progress
}

function getVolume(): number {
  // Always return the current audio manager volume to ensure consistency
  return audio.getVolume()
}

async function setVolume(newVolume: number): Promise<number> {
  volume = Math.max(0, Math.min(1, newVolume))
  isMuted = volume === 0
  const actualVolume = await audio.setVolume(volume)
  // Update our local volume to match the actual system volume (already in 0-1 range)
  volume = actualVolume
  return actualVolume
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
  qs.queue = []
  qs.manuallyStoppedByUser = false
  await stopPlayback()
  saveState()
}

function removeFromQueue(index: number): void {
  if (index >= 0 && index < qs.queue.length) {
    qs.queue.splice(index, 1)
    saveState()
  }
}

function reorderQueue(fromIndex: number, toIndex: number): void {
  if (fromIndex >= 0 && fromIndex < qs.queue.length &&
      toIndex >= 0 && toIndex < qs.queue.length) {
    const movedTrack = qs.queue.splice(fromIndex, 1)[0]
    qs.queue.splice(toIndex, 0, movedTrack)
    saveState()
  }
}

// Get debug information about the current state
function getDebugInfo(): DebugInfo {
  const audioStatus = audio.getStatus()
  return {
    queueLength: qs.queue.length,
    currentTrack: qs.currentTrack,
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
        const found = qs.queue.find(t => t.path.endsWith(filename));
        if (found) return found.path;
        // If not found, try currentTrack
        if (qs.currentTrack && qs.currentTrack.path.endsWith(filename)) return qs.currentTrack.path;
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
  if (qs.currentTrack && audioFactory.getCurrentType() === 'vlc') {
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
        qs.isPlaying = state === 'playing';
        const timeMatch = statusText.match(/<time>(\d+)<\/time>/);
        const lengthMatch = statusText.match(/<length>(\d+)<\/length>/);
        if (timeMatch && lengthMatch) {
          const currentTime = parseInt(timeMatch[1], 10);
          const totalLength = parseInt(lengthMatch[1], 10);
          qs.progress = totalLength > 0 ? currentTime / totalLength : 0;
        }
      }
    } catch (error) {
      // If VLC is unreachable, keep current state
      console.error('getCurrentState: Error syncing with VLC:', error);
    }
  } else if (qs.currentTrack && audioFactory.getCurrentType() === 'afplay') {
    // For AFPLAY, use the audio manager's methods instead of trying to connect to VLC
    try {
      const currentAudioManager = audioFactory.getCurrentManager();
      if (currentAudioManager) {
        const audioStatus = currentAudioManager.getStatus();
        qs.isPlaying = audioStatus.isPlaying;
        qs.progress = currentAudioManager.getPlaybackProgress();
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
    isPlaying: qs.isPlaying,
    currentTrack: qs.currentTrack,
    queue: qs.queue,
    progress: qs.progress,
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
    // ── Step 1: Cancel all in-flight playback by incrementing generation ────────
    // Any playNextInQueue call that is currently awaiting will see a stale
    // generation on its next await and abort without touching VLC or the queue.
    const stopGen = ++qs.playbackGeneration
    qs.manuallyStoppedByUser = true
    qs.isStopping = true

    console.log(`🛑 Queue State: stopAllPlayback (gen=${stopGen})`)

    // Clear completion callback synchronously — prevents the 250ms completion
    // interval from firing onTrackComplete and restarting a new track.
    const currentAudioManager = audioFactory.getCurrentManager()
    if (currentAudioManager) {
      currentAudioManager.clearTrackCompleteCallback()
    }

    // ── Step 2: Wait for any in-flight playNextInQueue to release its lock ──────
    if (qs.playbackInProgress) {
      console.log('⏳ Queue State: waiting for in-flight playback to abort...')
      const deadline = Date.now() + 800
      while (qs.playbackInProgress && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 30))
      }
      qs.playbackInProgress = false // force-clear regardless
    }

    // ── Step 3: Force-stop VLC, retrying until confirmed stopped ────────────────
    // An in-flight playFile may have sent pl_empty+in_play+pl_play to VLC
    // before it noticed the cancelled generation. VLC may therefore still be
    // playing. We retry forceStop until VLC confirms it is stopped.
    if (currentAudioManager) {
      for (let attempt = 0; attempt < 4; attempt++) {
        await currentAudioManager.forceStop()
        // Small gap so VLC can process the command
        await new Promise(r => setTimeout(r, 100))
        // Check VLC state directly
        try {
          const statusUrl = `http://localhost:8081/requests/status.xml`
          const resp = await fetch(statusUrl, {
            headers: { 'Authorization': `Basic ${Buffer.from(':jukebox').toString('base64')}` }
          })
          if (resp.ok) {
            const text = await resp.text()
            const stateMatch = text.match(/<state>([^<]+)<\/state>/)
            const vlcState = stateMatch ? stateMatch[1] : 'unknown'
            if (vlcState === 'stopped') {
              console.log(`🛑 Queue State: VLC confirmed stopped (attempt ${attempt + 1})`)
              break
            }
            console.log(`🛑 Queue State: VLC still "${vlcState}" after attempt ${attempt + 1}, retrying...`)
          }
        } catch {
          // VLC unreachable — treat as stopped
          break
        }
      }
    }

    // ── Step 4: Update state ────────────────────────────────────────────────────
    qs.currentTrack = null
    qs.isPlaying = false
    qs.progress = 0
    qs.isStopping = false
    saveState()
    console.log(`🛑 Queue State: stopAllPlayback complete, queue preserved (${qs.queue.length} tracks)`)
  },
  // skipToNext delegates to playNextInQueue, which owns all concurrency control.
  skipToNext: () => playNextInQueue(),
  getProgress,
  getVolume,
  setVolume,
  getIsMuted,
  toggleMute,
  seekPlayback,
  getCurrentState
}

export default queueState 