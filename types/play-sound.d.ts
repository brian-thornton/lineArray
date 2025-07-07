import { ChildProcess } from 'child_process'

declare module 'play-sound' {
  interface PlayOptions {
    players?: string[]
  }
  
  interface Player {
    play: (filePath: string, callback?: (error?: Error) => void) => any
  }
  
  function player(options?: PlayOptions): Player
  export = player
} 