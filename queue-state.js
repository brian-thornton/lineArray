const AudioManager = require('./audio-manager')
const audio = new AudioManager()

let queue = []
let currentTrack = null

async function playNextInQueue() {
  if (queue.length === 0) {
    await audio.stop()
    currentTrack = null
    return false
  }
  const nextTrack = queue.shift() ?? null
  currentTrack = nextTrack
  if (!nextTrack) {
    await audio.stop()
    currentTrack = null
    return false
  }
  const success = await audio.playFile(nextTrack)
  return success
}

function getQueue() {
  return queue
}

function getCurrentTrack() {
  return currentTrack
}

function addToQueue(path) {
  queue.push(path)
}

function getIsPlaying() {
  // Check both the audio manager status and if we have a current track
  return audio.isPlaying && currentTrack !== null
}

async function clearCurrentTrack() {
  currentTrack = null
  await audio.stop()
}

async function clearQueue() {
  queue = []
  await audio.stop()
  currentTrack = null
}

module.exports = {
  getQueue,
  getCurrentTrack,
  addToQueue,
  getIsPlaying,
  playNextInQueue,
  clearCurrentTrack,
  clearQueue,
} 