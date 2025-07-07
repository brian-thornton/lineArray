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
  getStatus(): AudioStatus
  resetState(): void
  checkAndRestart(): Promise<boolean>
  setCurrentFile(filePath: string): void
  getCurrentSong(): CurrentSong
  setVolume(volume: number): boolean
  getVolume(): number
  toggleMute(): boolean
  isMuted(): boolean
  getPlaybackProgress(): number
  isTrackFinished(): boolean
  estimateDuration(filePath: string): number
  killAllAudioProcesses(): Promise<void>
  applySystemVolume(): void
  muteSystemAudio(): void
  unmuteSystemAudio(): void

}

export interface QueueStateInterface {
  getQueue(): QueueTrack[]
  getCurrentTrack(): QueueTrack | null
  addToQueue(path: string): void
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
} 