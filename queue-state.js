const AudioManager = require('./audio-manager')
const fs = require('fs')
const path = require('path')
const audio = new AudioManager()

let queue = []
let currentTrack = null

// File path for persisting queue state
const STATE_FILE_PATH = path.join(process.cwd(), 'data', 'queue-state.json')

// Save queue state to file
function saveState() {
  try {
    const state = {
      queue: queue,
      currentTrack: currentTrack,
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
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const data = fs.readFileSync(STATE_FILE_PATH, 'utf-8')
      const state = JSON.parse(data)
      
      // Only restore if the state is recent (within last 24 hours)
      const isRecent = (Date.now() - state.timestamp) < (24 * 60 * 60 * 1000)
      
      if (isRecent && state.queue && Array.isArray(state.queue)) {
        queue = state.queue
        currentTrack = state.currentTrack
        console.log('Queue state restored from:', STATE_FILE_PATH)
        console.log('Restored queue length:', queue.length)
        console.log('Restored current track:', currentTrack)
        
        // Check if we need to restart audio for the current track
        if (currentTrack) {
          // Set the current file in audio manager for state consistency
          audio.setCurrentFile(currentTrack.path)
          
          // Only restart if we were actually playing before (not just paused)
          // This prevents unwanted restarts during normal navigation
          setTimeout(async () => {
            const audioStatus = audio.getStatus()
            if (!audioStatus.isPlaying && !audioStatus.hasProcess) {
              console.log('State restored but not auto-restarting audio - user can manually resume if needed')
              // Don't auto-restart - let the user control playback
            }
          }, 1000)
        }
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

async function playNextInQueue() {
  console.log('playNextInQueue: Starting, queue length:', queue.length)
  
  if (queue.length === 0) {
    console.log('playNextInQueue: Queue is empty, stopping audio')
    await audio.stop()
    currentTrack = null
    saveState() // Save state when clearing current track
    return false
  }
  
  const nextTrack = queue.shift() ?? null
  console.log('playNextInQueue: Next track from queue:', nextTrack)
  
  currentTrack = nextTrack
  console.log('playNextInQueue: Set currentTrack to:', currentTrack)
  saveState() // Save state when setting new current track
  
  if (!nextTrack) {
    console.log('playNextInQueue: No next track, stopping audio')
    await audio.stop()
    currentTrack = null
    saveState()
    return false
  }
  
  console.log('playNextInQueue: Playing file:', nextTrack.path)
  const success = await audio.playFile(nextTrack.path)
  console.log('playNextInQueue: playFile result:', success)
  
  return success
}

function getQueue() {
  return queue
}

function getCurrentTrack() {
  return currentTrack
}

// Get debug information about the current state
function getDebugInfo() {
  const audioStatus = audio.getStatus()
  return {
    queueLength: queue.length,
    currentTrack: currentTrack,
    audioStatus: audioStatus,
    hasStateFile: fs.existsSync(STATE_FILE_PATH),
    stateFileSize: fs.existsSync(STATE_FILE_PATH) ? fs.statSync(STATE_FILE_PATH).size : 0
  }
}

// Check and restore audio state if needed (called periodically)
async function checkAudioState() {
  const audioStatus = audio.getStatus()
  
  // Only restart if we have a current track but no audio process AND we were playing before kill
  if (currentTrack && !audioStatus.isPlaying && !audioStatus.hasProcess && audioStatus.wasPlayingBeforeKill) {
    console.log('checkAudioState: Detected missing audio process that was playing, attempting restart')
    audio.resetState()
    audio.currentFile = currentTrack.path
    await audio.checkAndRestart()
  }
}

function addToQueue(path) {
  // Generate a unique ID for the track
  const trackId = `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const track = {
    id: trackId,
    path: path,
    title: path.split('/').pop().replace(/\.[^/.]+$/, ''),
    artist: 'Unknown',
    album: 'Unknown',
    duration: '0:00'
  }
  queue.push(track)
  saveState() // Save state when adding to queue
}

function getIsPlaying() {
  // Check if audio is actually playing and we have a current track
  const audioStatus = audio.getStatus()
  const hasCurrentTrack = currentTrack !== null
  const isActuallyPlaying = audioStatus.isPlaying && hasCurrentTrack
  
  console.log('getIsPlaying: audioStatus.isPlaying:', audioStatus.isPlaying, 'currentTrack:', currentTrack, 'isActuallyPlaying:', isActuallyPlaying, 'audioStatus:', audioStatus)
  
  // Only attempt restart if we have a current track but no audio process AND we're not in a normal navigation scenario
  // We'll be more conservative about restarts to avoid interrupting playback during navigation
  if (hasCurrentTrack && !audioStatus.isPlaying && !audioStatus.hasProcess) {
    // Check if this is a legitimate restart scenario (e.g., after server restart or process kill)
    // We'll only restart if the audio was previously playing and got interrupted
    const shouldRestart = audioStatus.wasPlayingBeforeKill || false
    
    if (shouldRestart) {
      console.log('Audio process was killed but we have a current track, attempting to restart...')
      // Reset audio state and attempt restart
      audio.resetState()
      audio.currentFile = currentTrack.path // Set the current file so restart works
      // Schedule restart attempt
      setTimeout(async () => {
        if (currentTrack && !audio.getStatus().isPlaying) {
          console.log('Restarting playback for current track:', currentTrack.path)
          await audio.checkAndRestart()
        }
      }, 100)
    } else {
      console.log('Audio process missing but not restarting - likely normal navigation')
    }
    
    // Return true to indicate we should be playing (even if temporarily stopped)
    return true
  }
  
  // Check if track has finished and we should move to next
  if (isActuallyPlaying && audio.isTrackFinished()) {
    console.log('Track finished, moving to next...')
    // Schedule next track
    setTimeout(async () => {
      await playNextInQueue()
    }, 100)
    return false
  }
  
  // Return true if we have a current track (even if audio is temporarily stopped)
  // This prevents the player from disappearing during recompiles
  const shouldShowPlayer = hasCurrentTrack || isActuallyPlaying
  
  // If we have a current track but no audio process, log it for debugging
  if (hasCurrentTrack && !audioStatus.hasProcess) {
    console.log('getIsPlaying: Preserving player state - has track but no audio process')
  }
  
  return shouldShowPlayer
}

async function clearCurrentTrack() {
  currentTrack = null
  await audio.stop()
  saveState() // Save state when clearing current track
}

async function clearQueue() {
  queue = []
  await audio.stop()
  currentTrack = null
  saveState() // Save state when clearing queue
}

function removeFromQueue(index) {
  if (index >= 0 && index < queue.length) {
    queue.splice(index, 1)
    saveState() // Save state when removing from queue
  }
}

function reorderQueue(fromIndex, toIndex) {
  if (fromIndex >= 0 && fromIndex < queue.length && 
      toIndex >= 0 && toIndex < queue.length) {
    const [movedTrack] = queue.splice(fromIndex, 1)
    queue.splice(toIndex, 0, movedTrack)
    saveState() // Save state when reordering queue
  }
}

module.exports = {
  getQueue,
  getCurrentTrack,
  addToQueue,
  getIsPlaying,
  playNextInQueue,
  clearCurrentTrack,
  clearQueue,
  removeFromQueue,
  reorderQueue,
  checkAudioState,
  saveState,
  loadState,
  getDebugInfo,
  audio
} 