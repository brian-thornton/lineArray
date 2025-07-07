import fs from 'fs'
import path from 'path'
import AudioManager from './audio-manager'
import type { QueueTrack, QueueState, DebugInfo, AudioManagerInterface, QueueStateInterface } from './types/audio'

const audio: AudioManagerInterface = new AudioManager()

let queue: QueueTrack[] = []
let currentTrack: QueueTrack | null = null

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

async function playNextInQueue(): Promise<boolean> {
  console.log('playNextInQueue: Starting, queue length:', queue.length)
  
  if (queue.length === 0) {
    console.log('playNextInQueue: Queue is empty, stopping audio')
    await audio.stop()
    currentTrack = null
    saveState() // Save state when clearing current track
    return false
  }
  
  const nextTrack = queue.shift() || null
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

function getQueue(): QueueTrack[] {
  return queue
}

function getCurrentTrack(): QueueTrack | null {
  return currentTrack
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

// Check and restore audio state if needed (called periodically)
async function checkAudioState(): Promise<void> {
  const audioStatus = audio.getStatus()
  
  // Only restart if we have a current track but no audio process AND we were playing before kill
  if (currentTrack && !audioStatus.isPlaying && !audioStatus.hasProcess && audioStatus.wasPlayingBeforeKill) {
    console.log('checkAudioState: Detected missing audio process that was playing, attempting restart')
    audio.resetState()
    audio.setCurrentFile(currentTrack.path)
    await audio.checkAndRestart()
  }
}

function addToQueue(filePath: string): void {
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
  saveState() // Save state when adding to queue
  
  // If no track is currently playing, start playing this track
  if (!currentTrack) {
    console.log('addToQueue: No current track, starting playback')
    void playNextInQueue()
  }
}

function getIsPlaying(): boolean {
  // Check if audio is actually playing and we have a current track
  const audioStatus = audio.getStatus()
  const hasCurrentTrack = currentTrack !== null
  const isActuallyPlaying = audioStatus.isPlaying && hasCurrentTrack
  
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
      if (currentTrack) {
        audio.setCurrentFile(currentTrack.path) // Set the current file so restart works
      }
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
  
  return shouldShowPlayer
}

async function clearCurrentTrack(): Promise<void> {
  currentTrack = null
  await audio.stop()
  saveState() // Save state when clearing current track
}

async function clearQueue(): Promise<void> {
  queue = []
  await audio.stop()
  currentTrack = null
  saveState() // Save state when clearing queue
}

function removeFromQueue(index: number): void {
  if (index >= 0 && index < queue.length) {
    queue.splice(index, 1)
    saveState() // Save state when removing from queue
  }
}

function reorderQueue(fromIndex: number, toIndex: number): void {
  if (fromIndex >= 0 && fromIndex < queue.length && 
      toIndex >= 0 && toIndex < queue.length) {
    const movedTrack = queue.splice(fromIndex, 1)[0]
    queue.splice(toIndex, 0, movedTrack)
    saveState() // Save state when reordering queue
  }
}

const queueState: QueueStateInterface = {
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

export default queueState 