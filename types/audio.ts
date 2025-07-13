import { ChildProcess } from 'child_process'

export interface AudioStatus {
  isPlaying: boolean
  currentFile: string | null
  hasProcess: boolean
  platform: string
  wasPlayingBeforeKill: boolean
}

export interface CurrentSong {
  file: string | null
  title: string | null
}

export interface QueueTrack {
  id: string
  path: string
  title: string
  artist: string
  album: string
  duration: string
}

export interface QueueState {
  queue: QueueTrack[]
  currentTrack: QueueTrack | null
  timestamp: number
}

export interface DebugInfo {
  queueLength: number
  currentTrack: QueueTrack | null
  audioStatus: AudioStatus
  hasStateFile: boolean
  stateFileSize: number
}

export interface AudioManagerInterface {
  playFile(filePath: string): Promise<boolean>
  stop(): Promise<boolean>
  pause(): Promise<boolean>
  resume(): Promise<boolean>
  seek(position: number): Promise<boolean>
  getStatus(): AudioStatus
  resetState(): void
  checkAndRestart(): Promise<boolean>
  setCurrentFile(filePath: string): void
  getCurrentSong(): CurrentSong
  setVolume(volume: number): Promise<number>
  getVolume(): number
  toggleMute(): boolean
  isMuted(): boolean
  getPlaybackProgress(): number
  isTrackFinished(): boolean
  estimateDuration(filePath: string): number
  killAllAudioProcesses(): Promise<void>

  muteSystemAudio(): void
  unmuteSystemAudio(): void
  setTrackCompleteCallback(callback: () => void): void
  setProgressCallback(callback: (progress: number) => void): void
  getLatestProgress(): number
  getVLCProgress(): Promise<number>
  getVLCDuration(): Promise<number>
}

export interface QueueStateInterface {
  getQueue(): QueueTrack[]
  getCurrentTrack(): QueueTrack | null
  addToQueue(path: string): Promise<void>
  getIsPlaying(): boolean
  playNextInQueue(): Promise<boolean>
  clearCurrentTrack(): Promise<void>
  clearQueue(): Promise<void>
  removeFromQueue(index: number): void
  reorderQueue(fromIndex: number, toIndex: number): void
  checkAudioState(): Promise<void>
  saveState(): void
  loadState(): void
  getDebugInfo(): DebugInfo
  audio: AudioManagerInterface
  stopAllPlayback(): Promise<void>
  getProgress(): number
  getVolume(): number
  setVolume(volume: number): Promise<number>
  getIsMuted(): boolean
  toggleMute(): boolean
  seekPlayback(position: number): Promise<boolean>
  getCurrentState(): Promise<{
    isPlaying: boolean
    currentTrack: QueueTrack | null
    queue: QueueTrack[]
    progress: number
    volume: number
    isMuted: boolean
  }>
} 