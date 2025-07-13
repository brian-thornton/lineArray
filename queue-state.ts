import fs from 'fs'
import path from 'path'
import AudioManager from './audio-manager'
import type { QueueTrack, QueueState, DebugInfo, AudioManagerInterface, QueueStateInterface } from './types/audio'

const audio: AudioManagerInterface = new AudioManager()

let queue: QueueTrack[] = []
let currentTrack: QueueTrack | null = null
let isPlaying: boolean = false
let progress: number = 0
let volume: number = 1.0
let isMuted: boolean = false

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

// Sync volume with audio manager on startup
function syncVolumeWithAudioManager(): void {
  const audioVolume = audio.getVolume()
  volume = audioVolume
  isMuted = audio.isMuted()
  console.log('Queue state: Synced volume with audio manager:', `${Math.round(volume * 100)}%`)
}

// Sync volume after a short delay to allow audio manager to query system volume
setTimeout(syncVolumeWithAudioManager, 1000)

// Set up the track completion callback
audio.setTrackCompleteCallback(() => {
  console.log('Queue state: Track completed, playing next in queue')
  void playNextInQueue()
})

// Set up the progress callback to update UI
audio.setProgressCallback((newProgress: number) => {
  progress = newProgress
})

async function playNextInQueue(): Promise<boolean> {
  console.log('playNextInQueue: Starting, queue length:', queue.length)
  
  if (queue.length === 0) {
    console.log('playNextInQueue: Queue is empty, stopping audio')
    await stopPlayback()
    return false
  }
  
  const nextTrack = queue.shift() || null
  console.log('playNextInQueue: Next track from queue:', nextTrack)
  
  if (!nextTrack) {
    console.log('playNextInQueue: No next track, stopping audio')
    await stopPlayback()
    return false
  }
  
  currentTrack = nextTrack
  console.log('playNextInQueue: Set currentTrack to:', currentTrack)
  saveState()
  
  console.log('playNextInQueue: Playing file:', nextTrack.path)
  const success = await audio.playFile(nextTrack.path)
  console.log('playNextInQueue: playFile result:', success)
  
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
}

async function startPlayback(): Promise<boolean> {
  if (currentTrack) {
    console.log('startPlayback: Starting playback for current track')
    const success = await audio.playFile(currentTrack.path)
    if (success) {
      isPlaying = true
    }
    return success
  } else if (queue.length > 0) {
    console.log('startPlayback: No current track, playing next in queue')
    return await playNextInQueue()
  } else {
    console.log('startPlayback: No tracks to play')
    return false
  }
}

async function stopPlayback(): Promise<boolean> {
  console.log('stopPlayback: Stopping all playback')
  const success = await audio.stop()
  isPlaying = false
  currentTrack = null
  progress = 0
  saveState()
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
  // After seek, poll VLC for latest state
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
  if (success) {
    console.log('seekPlayback: Seek completed, isPlaying:', isPlaying, 'progress:', progress)
  }
  return success
}

async function addToQueue(filePath: string): Promise<void> {
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
  
  // If no track is currently playing, start playing this track
  if (!currentTrack && !isPlaying) {
    console.log('addToQueue: No current track, starting playback')
    const success = await playNextInQueue()
    if (success) {
      console.log('addToQueue: Playback started successfully')
    } else {
      console.log('addToQueue: Failed to start playback')
    }
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

// Helper to get current file from VLC
async function getCurrentFileFromVLC(): Promise<string | null> {
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
}

// Robust getCurrentState with VLC sync
async function getCurrentState(): Promise<{
  isPlaying: boolean
  currentTrack: QueueTrack | null
  queue: QueueTrack[]
  progress: number
  volume: number
  isMuted: boolean
}> {
  // Sync with VLC's actual state if we have a current track
  if (currentTrack) {
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
  stopAllPlayback: async () => { await stopPlayback(); },
  getProgress,
  getVolume,
  setVolume,
  getIsMuted,
  toggleMute,
  seekPlayback,
  getCurrentState
}

export default queueState 