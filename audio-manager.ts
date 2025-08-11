import player from 'play-sound'
import { exec, type ChildProcess } from 'child_process'
import fs from 'fs'
// VLC HTTP API client - we'll implement this manually
import logger from './utils/serverLogger'
import type { AudioStatus, CurrentSong, AudioManagerInterface } from './types/audio'

const audioPlayer = player({
  // Windows-specific configuration
  players: process.platform === 'win32' ? ['mplayer', 'mpg123', 'mpg321'] : undefined
})

class AudioManager implements AudioManagerInterface {
  private currentProcess: ChildProcess | null = null
  private isPlaying = false
  private currentFile: string | null = null
  private readonly platform: string
  private volume = 1.0
  private muted = false
  private playbackStartTime: number | null = null
  private estimatedDuration = 0 // in seconds
  private wasPlayingBeforeKill = false // Track if we were playing before process was killed
  private onTrackComplete: (() => void) | null = null // Callback for track completion
  private vlcProcess: ChildProcess | null = null
  private vlcPort: number = 8080
  private vlcPassword: string = 'jukebox'
  private vlcProgressInterval: NodeJS.Timeout | null = null
  private vlcProgressCallback: ((progress: number) => void) | null = null
  private latestProgress: number = 0

  constructor() {
    this.platform = process.platform
    console.log('Audio Manager: Initialized for platform:', this.platform)
    
    // Query system volume on startup
    this.querySystemVolumeOnStartup()
  }

  // Query system volume on startup and sync our internal state
  private async querySystemVolumeOnStartup(): Promise<void> {
    try {
      let command: string
      
      if (this.platform === 'win32') {
        // Windows: Use PowerShell to get system volume
        command = 'powershell -Command "[math]::Round((Get-AudioDevice -Playback).Volume / 100, 2)"'
      } else {
        // macOS: Use osascript to get system volume
        command = 'osascript -e "output volume of (get volume settings)"'
      }
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log('Audio Manager: Error querying system volume:', error.message)
          console.log('Audio Manager: Using default volume:', this.volume)
        } else {
          try {
            const systemVolume = parseFloat(stdout.trim())
            if (!isNaN(systemVolume)) {
              // Convert from percentage to 0-1 range
              const normalizedVolume = this.platform === 'win32' ? systemVolume : systemVolume / 100
              this.volume = Math.max(0, Math.min(1, normalizedVolume))
              console.log('Audio Manager: System volume queried on startup:', `${Math.round(this.volume * 100)}%`)
            } else {
              console.log('Audio Manager: Invalid system volume response, using default:', this.volume)
            }
          } catch (parseError) {
            console.log('Audio Manager: Error parsing system volume, using default:', this.volume)
          }
        }
      })
    } catch (error) {
      console.error('Audio Manager: Error in querySystemVolumeOnStartup:', error)
    }
  }

  // Set the completion callback
  setTrackCompleteCallback(callback: () => void): void {
    this.onTrackComplete = callback
  }

  clearTrackCompleteCallback(): void {
    this.onTrackComplete = null
  }

  setProgressCallback(callback: (progress: number) => void): void {
    this.vlcProgressCallback = callback
  }

  getLatestProgress(): number {
    // Always return the last polled value, even if isPlaying is false
    return this.latestProgress;
  }

  private startVLCProgressPolling(): void {
    if (this.vlcProgressInterval) {
      clearInterval(this.vlcProgressInterval)
    }
    
    this.vlcProgressInterval = setInterval(async () => {
      if (this.currentFile && this.isPlaying) {
        try {
          const progress = await this.getVLCProgress()
          this.latestProgress = progress
          if (this.vlcProgressCallback) {
            this.vlcProgressCallback(progress)
          }
          
          // Check for track completion
          console.log('VLC Progress Polling: Checking for completion...');
          await this.checkVLCCompletion()
        } catch (error) {
          console.error('VLC Progress Polling: Error:', error)
        }
      } else if (!this.isPlaying) {
        // Stop polling if not playing
        this.stopVLCProgressPolling()
      }
    }, 1000) // Poll every second
    
    console.log('VLC Progress Polling: Started')
  }

  private stopVLCProgressPolling(): void {
    if (this.vlcProgressInterval) {
      clearInterval(this.vlcProgressInterval)
      this.vlcProgressInterval = null
      console.log('VLC Progress Polling: Stopped')
    }
  }

  async playFile(filePath: string): Promise<boolean> {
    try {
      logger.info('Starting playback', 'AudioManager', { filePath })
      
      // If we're already playing this file, don't restart
      if (this.currentFile === filePath && this.isPlaying && this.vlcProcess) {
        logger.info('Already playing this file, skipping restart', 'AudioManager', { filePath })
        return true
      }
      
      // Stop any currently playing audio
      await this.stop()
      
      // Estimate duration based on file size (rough approximation)
      this.estimatedDuration = this.estimateDuration(filePath)
      this.playbackStartTime = Date.now()
      
      logger.info('Starting VLC playback', 'AudioManager')
      
      // Start VLC if not already running
      if (!this.vlcProcess) {
        const vlcStarted = await this.startVLC()
        if (!vlcStarted) {
          logger.error('VLC failed to start', 'AudioManager')
          return false
        }
      }
      
      // Load and play the file with VLC
      const success = await this.vlcLoadFile(filePath)
      if (success) {
        this.isPlaying = true
        this.currentFile = filePath
        this.wasPlayingBeforeKill = false
        
        // Start progress polling
        this.startVLCProgressPolling()
        
        logger.info('Playback started successfully', 'AudioManager', { 
          filePath, 
          isPlaying: this.isPlaying,
          estimatedDuration: this.estimatedDuration 
        })
        return true
      } else {
        logger.error('VLC failed to load file', 'AudioManager', { filePath })
        return false
      }
    } catch (error) {
      logger.error('Error playing file', 'AudioManager', { filePath, error: error instanceof Error ? error.message : String(error) })
      this.isPlaying = false
      this.currentFile = null
      this.playbackStartTime = null
      this.wasPlayingBeforeKill = false
      return false
    }
  }

  estimateDuration(filePath: string): number {
    // Rough estimation based on file size
    // This is a very basic approximation - in a real app you'd use metadata
    try {
      const stats = fs.statSync(filePath)
      const sizeInMB = stats.size / (1024 * 1024)
      // Assume roughly 1MB per minute for MP3
      return Math.max(30, Math.min(600, sizeInMB * 60)) // Between 30 seconds and 10 minutes
    } catch (error) {
      return 180 // Default 3 minutes
    }
  }

  getPlaybackProgress(): number {
    if (!this.isPlaying || !this.currentFile) {
      return 0
    }
    
    // Fall back to estimated calculation for now
    // TODO: Implement async VLC progress fetching
    if (!this.playbackStartTime || !this.estimatedDuration) {
      return 0;
    }
    const elapsed = (Date.now() - this.playbackStartTime) / 1000;
    const progress = Math.min(1, elapsed / this.estimatedDuration);
    return progress;
  }

  async getVLCProgress(): Promise<number> {
    if (!this.currentFile) {
      return 0;
    }
    
    try {
      const statusUrl = `http://localhost:${this.vlcPort}/requests/status.xml`;
      
      const response = await fetch(statusUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      });
      
      if (!response.ok) {
        // If VLC is unreachable, reset state
        if (response.status === 0 || response.status === 502 || response.status === 503 || response.status === 504) {
          this.isPlaying = false;
          this.currentFile = null;
        }
        return 0;
      }
      
      const statusText = await response.text();
      
      const timeMatch = statusText.match(/<time>(\d+)<\/time>/);
      const lengthMatch = statusText.match(/<length>(\d+)<\/length>/);
      const stateMatch = statusText.match(/<state>(\w+)<\/state>/);
      
      if (timeMatch && lengthMatch && stateMatch) {
        const currentTime = parseInt(timeMatch[1]);
        const totalLength = parseInt(lengthMatch[1]);
        const state = stateMatch[1];
        
        if (totalLength > 0) {
          const progress = currentTime / totalLength;
          return progress;
        } else {
          return 0;
        }
      } else {
        return 0;
      }
    } catch (error) {
      return 0;
    }
  }

  async getVLCDuration(): Promise<number> {
    if (!this.currentFile) {
      return 0;
    }
    
    try {
      const statusUrl = `http://localhost:${this.vlcPort}/requests/status.xml`;
      const response = await fetch(statusUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      });
      
      if (!response.ok) {
        return 0;
      }
      
      const statusText = await response.text();
      const lengthMatch = statusText.match(/<length>(\d+)<\/length>/);
      
      if (lengthMatch) {
        const duration = parseInt(lengthMatch[1]);
        console.log('VLC Duration: Actual duration from VLC:', duration, 'seconds');
        return duration;
      }
      
      return 0;
    } catch (error) {
      console.error('VLC Duration: Error:', error);
      return 0;
    }
  }

  isTrackFinished(): boolean {
    if (!this.isPlaying || !this.playbackStartTime || !this.estimatedDuration) {
      return false
    }
    
    const elapsed = (Date.now() - this.playbackStartTime) / 1000
    return elapsed >= this.estimatedDuration
  }

  // Separate method to check VLC state for track completion
  async checkVLCCompletion(): Promise<void> {
    if (!this.isPlaying || !this.currentFile) {
      return;
    }
    
    try {
      const statusUrl = `http://localhost:${this.vlcPort}/requests/status.xml`;
      const response = await fetch(statusUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      });
      
      if (!response.ok) {
        console.log('Audio Manager: VLC status request failed:', response.status);
        return;
      }
      
      const statusText = await response.text();
      const timeMatch = statusText.match(/<time>(\d+)<\/time>/);
      const lengthMatch = statusText.match(/<length>(\d+)<\/length>/);
      const stateMatch = statusText.match(/<state>(\w+)<\/state>/);
      
      if (timeMatch && lengthMatch && stateMatch) {
        const currentTime = parseInt(timeMatch[1]);
        const totalLength = parseInt(lengthMatch[1]);
        const state = stateMatch[1];
        
        console.log('Audio Manager: VLC Status Check - currentTime:', currentTime, 'totalLength:', totalLength, 'state:', state, 'isPlaying:', this.isPlaying);
        
        // VLC time values are in seconds, but let's be more lenient with the completion detection
        const timeThreshold = Math.max(1, Math.floor(totalLength * 0.95)); // 95% of track length
        
        // Check if track is finished (at end or stopped)
        if (state === 'stopped' || (totalLength > 0 && currentTime >= timeThreshold)) {
          console.log('Audio Manager: Track finished detected - currentTime:', currentTime, 'totalLength:', totalLength, 'threshold:', timeThreshold, 'state:', state);
          this.isPlaying = false;
          
          // Call the completion callback if set
          if (this.onTrackComplete) {
            console.log('Audio Manager: Calling track completion callback');
            this.onTrackComplete();
          } else {
            console.log('Audio Manager: No track completion callback set');
          }
        } else if (state === 'playing' && totalLength > 0 && currentTime >= timeThreshold) {
          // VLC might still show as playing but be at the end
          console.log('Audio Manager: Track at end but still playing - forcing completion');
          this.isPlaying = false;
          
          if (this.onTrackComplete) {
            console.log('Audio Manager: Calling track completion callback (forced)');
            this.onTrackComplete();
          } else {
            console.log('Audio Manager: No track completion callback set (forced)');
          }
        } else if (state === 'playing' && this.playbackStartTime && this.estimatedDuration) {
          // Fallback: check if we've been playing longer than the estimated duration
          const elapsed = (Date.now() - this.playbackStartTime) / 1000;
          if (elapsed > this.estimatedDuration + 5) { // 5 second buffer
            console.log('Audio Manager: Track exceeded estimated duration - forcing completion. Elapsed:', elapsed, 'Estimated:', this.estimatedDuration);
            this.isPlaying = false;
            
            if (this.onTrackComplete) {
              console.log('Audio Manager: Calling track completion callback (duration fallback)');
              this.onTrackComplete();
            } else {
              console.log('Audio Manager: No track completion callback set (duration fallback)');
            }
          }
        }
      } else {
        console.log('Audio Manager: Could not parse VLC status response:', statusText);
      }
    } catch (error) {
      console.log('Audio Manager: Error checking VLC completion:', error);
    }
  }

  async stop(): Promise<boolean> {
    try {
      logger.info('Stopping playback', 'AudioManager', { currentFile: this.currentFile })
      
      // Send stop command to VLC
      const stopUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=pl_stop`;
      await fetch(stopUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      });

      // Clear the playlist
      const clearUrl = `http://localhost:${this.vlcPort}/requests/playlist.xml?command=pl_empty`;
      await fetch(clearUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      });

      // Wait for VLC to actually stop
      let stopped = false;
      for (let i = 0; i < 10; i++) { // Try for up to 2 seconds
        const statusUrl = `http://localhost:${this.vlcPort}/requests/status.xml`;
        const response = await fetch(statusUrl, {
          headers: {
            'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
          }
        });
        if (response.ok) {
          const statusText = await response.text();
          if (statusText.includes('<state>stopped</state>')) {
            stopped = true;
            break;
          }
        }
        await new Promise(res => setTimeout(res, 200));
      }

      if (stopped) {
        this.isPlaying = false;
        this.currentFile = null;
        this.playbackStartTime = null;
        this.stopVLCProgressPolling();
        logger.info('Playback stopped successfully', 'AudioManager')
        return true;
      } else {
        logger.warn('VLC did not confirm stopped state', 'AudioManager')
        return false;
      }
    } catch (error) {
      logger.error('Error stopping playback', 'AudioManager', { error: error instanceof Error ? error.message : String(error) })
      return false
    }
  }

  async killAllAudioProcesses(): Promise<void> {
    return new Promise((resolve) => {
      let command: string
      
      if (this.platform === 'win32') {
        // Windows: Kill audio processes
        command = 'taskkill /f /im mplayer.exe /im mpg123.exe /im mpg321.exe /im afplay.exe 2>nul || echo "No audio processes found"'
      } else {
        // macOS/Linux: Kill audio processes
        command = 'pkill -f afplay; pkill -f mpg123; pkill -f mpg321; pkill -f mplayer; pkill -f "play-sound" || echo "No audio processes found"'
      }
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log('Audio Manager: Error killing audio processes:', error.message)
        } else {
          console.log('Audio Manager: Killed audio processes:', stdout)
        }
        resolve()
      })
    })
  }

  async pause(): Promise<boolean> {
    try {
      if (this.currentProcess) {
        // Windows-compatible pause
        if (this.platform === 'win32') {
          this.currentProcess.kill('SIGSTOP')
        } else {
          this.currentProcess.kill('SIGSTOP')
        }
        this.isPlaying = false
        console.log('Audio Manager: Playback paused')
      }
      return true
    } catch (error) {
      console.error('Audio Manager: Error pausing playback:', error)
      return false
    }
  }

  async resume(): Promise<boolean> {
    try {
      if (this.currentProcess) {
        // Windows-compatible resume
        if (this.platform === 'win32') {
          this.currentProcess.kill('SIGCONT')
        } else {
          this.currentProcess.kill('SIGCONT')
        }
        this.isPlaying = true
        console.log('Audio Manager: Playback resumed')
      }
      return true
    } catch (error) {
      console.error('Audio Manager: Error resuming playback:', error)
      return false
    }
  }

  async seek(position: number): Promise<boolean> {
    try {
      console.log('Audio Manager: Seeking to position:', position);
      
      // Wait until VLC is in a seekable state (playing/paused and time > 0)
      let seekable = false;
      let duration = 0;
      for (let i = 0; i < 10; i++) { // Try for up to 1 second
        const statusUrl = `http://localhost:${this.vlcPort}/requests/status.xml`;
        const statusResponse = await fetch(statusUrl, {
          headers: {
            'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
          }
        });
        if (statusResponse.ok) {
          const statusText = await statusResponse.text();
          const stateMatch = statusText.match(/<state>([^<]+)<\/state>/);
          const state = stateMatch ? stateMatch[1] : 'unknown';
          const timeMatch = statusText.match(/<time>(\d+)<\/time>/);
          const lengthMatch = statusText.match(/<length>(\d+)<\/length>/);
          const time = timeMatch ? parseInt(timeMatch[1], 10) : 0;
          duration = lengthMatch ? parseInt(lengthMatch[1], 10) : 0;
          if ((state === 'playing' || state === 'paused') && time > 0 && duration > 0) {
            seekable = true;
            break;
          }
        }
        await new Promise(res => setTimeout(res, 100));
      }
      if (!seekable) {
        console.log('Audio Manager: VLC not ready for seek (not playing/paused or time=0 or duration=0)');
        return false;
      }
      
      // Calculate target time in seconds
      const targetTimeSeconds = Math.round(position * duration);
      console.log('Audio Manager: Seeking to', targetTimeSeconds, 'seconds (', Math.round(position * 100), '% of', duration, 'seconds)');
      
      // Get current time before seeking
      const beforeSeekResponse = await fetch(`http://localhost:${this.vlcPort}/requests/status.xml`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      });
      let beforeTime = 0;
      if (beforeSeekResponse.ok) {
        const beforeStatusText = await beforeSeekResponse.text();
        const beforeTimeMatch = beforeStatusText.match(/<time>(\d+)<\/time>/);
        beforeTime = beforeTimeMatch ? parseInt(beforeTimeMatch[1], 10) : 0;
      }
      
      // Retry the seek command multiple times until it works
      let seekSuccess = false;
      for (let attempt = 1; attempt <= 5; attempt++) {
        console.log('Audio Manager: Seek attempt', attempt);
        
        // Send seek command
        const timeUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=seek&val=${targetTimeSeconds}`;
        const response = await fetch(timeUrl, {
          headers: {
            'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
          }
        });
        
        if (!response.ok) {
          console.error('Audio Manager: VLC seek command failed on attempt', attempt, ':', response.status, response.statusText);
          continue;
        }
        
        // Wait a moment for VLC to process the seek
        await new Promise(res => setTimeout(res, 200));
        
        // Check if the seek actually worked
        const afterSeekResponse = await fetch(`http://localhost:${this.vlcPort}/requests/status.xml`, {
          headers: {
            'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
          }
        });
        
        if (afterSeekResponse.ok) {
          const afterStatusText = await afterSeekResponse.text();
          const afterTimeMatch = afterStatusText.match(/<time>(\d+)<\/time>/);
          const afterTime = afterTimeMatch ? parseInt(afterTimeMatch[1], 10) : 0;
          
          // Check if time changed significantly (within 5 seconds of target)
          const timeDiff = Math.abs(afterTime - targetTimeSeconds);
          if (timeDiff <= 5) {
            console.log('Audio Manager: Seek successful on attempt', attempt, '- time changed from', beforeTime, 'to', afterTime, '(target was', targetTimeSeconds, ')');
            seekSuccess = true;
            break;
          } else {
            console.log('Audio Manager: Seek attempt', attempt, 'failed - time is', afterTime, 'but target was', targetTimeSeconds);
          }
        }
        
        // Wait before next attempt
        await new Promise(res => setTimeout(res, 100));
      }
      
      if (seekSuccess) {
        console.log('Audio Manager: VLC seek command completed successfully');
        return true;
      } else {
        console.error('Audio Manager: All seek attempts failed');
        return false;
      }
    } catch (error) {
      console.error('Audio Manager: Error during seek:', error);
      return false;
    }
  }



  private async startVLC(): Promise<boolean> {
    try {
      console.log('Audio Manager: Starting VLC with HTTP interface on port', this.vlcPort)
      
      // Start VLC with HTTP interface and audio output
      const vlcCommand = `vlc --intf http --http-port ${this.vlcPort} --http-password ${this.vlcPassword} --no-video --quiet --aout=coreaudio --no-http-reconnect`
      this.vlcProcess = exec(vlcCommand, (error, stdout, stderr) => {
        if (error) {
          console.error('Audio Manager: VLC process error:', error)
        } else {
          console.log('Audio Manager: VLC process finished')
        }
        this.vlcProcess = null
      })
      
      // Wait for VLC to start and be ready
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Test if VLC HTTP API is responding
      try {
        const testResponse = await fetch(`http://localhost:${this.vlcPort}/requests/status.xml`, {
          headers: {
            'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
          }
        })
        if (testResponse.ok) {
          console.log('Audio Manager: VLC HTTP API is responding')
          return true
        } else {
          console.error('Audio Manager: VLC HTTP API not responding:', testResponse.status)
          return false
        }
      } catch (error) {
        console.error('Audio Manager: Cannot connect to VLC HTTP API:', error)
        return false
      }
    } catch (error) {
      console.error('Audio Manager: Error starting VLC:', error)
      return false
    }
  }

  private async vlcLoadFile(filePath: string): Promise<boolean> {
    try {
      console.log('Audio Manager: Loading file into VLC:', filePath)
      
      // Check if we're already playing this file
      const statusUrl = `http://localhost:${this.vlcPort}/requests/status.xml`
      const statusResponse = await fetch(statusUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      
      if (statusResponse.ok) {
        const statusText = await statusResponse.text()
        console.log('Audio Manager: VLC status before loading:', statusText)
        // If we're already playing this file, just return success
        if (statusText.includes('playing') && this.currentFile === filePath) {
          console.log('Audio Manager: Already playing this file in VLC')
          return true
        }
      }
      
      // Clear the playlist first
      const clearUrl = `http://localhost:${this.vlcPort}/requests/playlist.xml?command=pl_empty`
      await fetch(clearUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      
      // Disable repeat mode to prevent the same track from repeating
      const repeatUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=pl_repeat`
      await fetch(repeatUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      
      // Add the file to the playlist
      const addUrl = `http://localhost:${this.vlcPort}/requests/playlist.xml?command=in_play&input=${encodeURIComponent(filePath)}`
      const addResponse = await fetch(addUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      
      if (!addResponse.ok) {
        console.error('Audio Manager: Failed to add file to VLC playlist:', addResponse.status)
        return false
      }
      
      // Wait a moment for the file to be added
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Then play the file
      const playUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=pl_play`
      const playResponse = await fetch(playUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      
      if (playResponse.ok) {
        console.log('Audio Manager: VLC loaded and started playing file:', filePath)
        
        // Wait a moment and check if it's actually playing
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Check playback status
        const finalStatusResponse = await fetch(statusUrl, {
          headers: {
            'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
          }
        })
        if (finalStatusResponse.ok) {
          const statusText = await finalStatusResponse.text()
          console.log('Audio Manager: VLC status after loading:', statusText)
          
          // Verify that VLC is actually playing
          if (statusText.includes('<state>playing</state>') && statusText.includes('<length>') && !statusText.includes('<length>0</length>')) {
            console.log('Audio Manager: VLC confirmed playing with valid file')
            return true
          } else {
            console.error('Audio Manager: VLC play command succeeded but not actually playing')
            return false
          }
        } else {
          console.error('Audio Manager: Could not verify VLC playback status')
          return false
        }
      } else {
        console.error('Audio Manager: VLC play command failed:', playResponse.status)
        return false
      }
    } catch (error) {
      console.error('Audio Manager: Error loading file into VLC:', error)
      return false
    }
  }

  private async vlcLoadFileWithSeek(filePath: string, seekTimeSeconds: number): Promise<boolean> {
    try {
      console.log('Audio Manager: Loading file into VLC with seek to', seekTimeSeconds, 'seconds:', filePath)
      
      // Clear the playlist first
      const clearUrl = `http://localhost:${this.vlcPort}/requests/playlist.xml?command=pl_empty`
      await fetch(clearUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      
      // Disable repeat mode to prevent the same track from repeating
      const repeatUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=pl_repeat`
      await fetch(repeatUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      
      // Add the file to the playlist
      const addUrl = `http://localhost:${this.vlcPort}/requests/playlist.xml?command=in_play&input=${encodeURIComponent(filePath)}`
      const addResponse = await fetch(addUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      
      if (!addResponse.ok) {
        console.error('Audio Manager: Failed to add file to VLC playlist:', addResponse.status)
        return false
      }
      
      // Wait a moment for the file to be added
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Then play the file
      const playUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=pl_play`
      const playResponse = await fetch(playUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      
      if (!playResponse.ok) {
        console.error('Audio Manager: VLC play command failed:', playResponse.status)
        return false
      }
      
      // Wait for playback to start
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Now seek to the desired position
      const seekUrl = `http://localhost:${this.vlcPort}/requests/status.xml?command=seek&val=${seekTimeSeconds}`
      const seekResponse = await fetch(seekUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
        }
      })
      
      if (seekResponse.ok) {
        console.log('Audio Manager: VLC loaded file and seeked to', seekTimeSeconds, 'seconds')
        
        // Verify that VLC is actually playing
        const verifyResponse = await fetch(`http://localhost:${this.vlcPort}/requests/status.xml`, {
          headers: {
            'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
          }
        })
        
        if (verifyResponse.ok) {
          const statusText = await verifyResponse.text()
          console.log('Audio Manager: VLC status after seek:', statusText)
          
          if (statusText.includes('<state>playing</state>') && statusText.includes('<length>') && !statusText.includes('<length>0</length>')) {
            console.log('Audio Manager: VLC confirmed playing after seek')
            return true
          } else {
            console.error('Audio Manager: VLC seek succeeded but not actually playing')
            return false
          }
        } else {
          console.error('Audio Manager: Could not verify VLC status after seek')
          return false
        }
      } else {
        console.error('Audio Manager: VLC seek command failed:', seekResponse.status)
        return false
      }
    } catch (error) {
      console.error('Audio Manager: Error loading file into VLC with seek:', error)
      return false
    }
  }



  getStatus(): AudioStatus {
    // Check if our process is still alive
    if (this.currentProcess && this.isPlaying) {
      try {
        // Try to check if process is still running (this might throw if process is dead)
        if (this.currentProcess.killed !== undefined && this.currentProcess.killed) {
          console.log('Audio Manager: Detected killed process, resetting state')
          this.wasPlayingBeforeKill = true // Mark that we were playing before kill
          this.resetState()
        }
      } catch (error) {
        console.log('Audio Manager: Process check failed, assuming killed:', (error as Error).message)
        this.wasPlayingBeforeKill = true // Mark that we were playing before kill
        this.resetState()
      }
    }
    
    // Check VLC's actual state and sync our internal state
    if (this.currentFile) {
      try {
        const statusUrl = `http://localhost:${this.vlcPort}/requests/status.xml`;
        fetch(statusUrl, {
          headers: {
            'Authorization': `Basic ${Buffer.from(`:${this.vlcPassword}`).toString('base64')}`
          }
        }).then(response => {
          if (response.ok) {
            return response.text();
          }
          return null;
        }).then(statusText => {
          if (statusText) {
            const isVLCPlaying = statusText.includes('<state>playing</state>');
            const isVLCPaused = statusText.includes('<state>paused</state>');
            const isVLCStopped = statusText.includes('<state>stopped</state>');
            
            // Sync our internal state with VLC's actual state
            if (isVLCStopped && this.isPlaying) {
              console.log('Audio Manager: VLC is stopped but we think we\'re playing - syncing state');
              this.isPlaying = false;
              // Try to reload the file if we have one
              if (this.currentFile) {
                console.log('Audio Manager: Attempting to reload file into VLC');
                void this.vlcLoadFile(this.currentFile);
              }
            } else if ((isVLCPlaying || isVLCPaused) && !this.isPlaying) {
              console.log('Audio Manager: VLC is playing/paused but we think we\'re stopped - syncing state');
              this.isPlaying = true;
            }
          }
        }).catch(error => {
          // Ignore errors - this is just a sync check
        });
      } catch (error) {
        // Ignore errors - this is just a sync check
      }
    }
    
    return {
      isPlaying: this.isPlaying,
      currentFile: this.currentFile,
      hasProcess: !!this.currentProcess,
      platform: this.platform,
      wasPlayingBeforeKill: this.wasPlayingBeforeKill
    }
  }

  // Reset state when process is killed externally (e.g., during recompile)
  resetState(): void {
    console.log('Audio Manager: Resetting state due to external process kill')
    this.currentProcess = null
    this.isPlaying = false
    // Don't clear currentFile - we want to preserve what should be playing
    this.playbackStartTime = null
    // Don't clear wasPlayingBeforeKill - we want to preserve this flag for restart logic
  }

  // Check if we need to restart playback after a process kill
  async checkAndRestart(): Promise<boolean> {
    if (this.currentFile && !this.isPlaying && !this.currentProcess) {
      console.log('Audio Manager: Detected killed process, restarting playback for:', this.currentFile)
      return await this.playFile(this.currentFile)
    }
    return false
  }

  // Set current file without starting playback (for state restoration)
  setCurrentFile(filePath: string): void {
    this.currentFile = filePath
    console.log('Audio Manager: Set current file to:', filePath)
  }

  getCurrentSong(): CurrentSong {
    return {
      file: this.currentFile,
      title: this.currentFile ? this.currentFile.split(/[\/\\]/).pop() || null : null
    }
  }

  async setVolume(volume: number): Promise<number> {
    this.volume = Math.max(0, Math.min(1, volume))
    this.muted = this.volume === 0
    console.log('Audio Manager: Volume set to:', this.volume)
    // Apply volume to system audio and return the actual system volume
    const actualVolumePercent = await this.applySystemVolume()
    // Update our internal volume to match the actual system volume
    this.volume = actualVolumePercent / 100
    return actualVolumePercent
  }

  /**
   * Set system volume and retry up to 3 times if needed. Returns the actual system volume (percent 0-100).
   */
  private applySystemVolume(): Promise<number> {
    return new Promise((resolve) => {
      const volumePercent = Math.round(this.volume * 100)
      const setAndVerify = (attempt: number = 1) => {
        let command: string
        if (this.platform === 'win32') {
          command = `powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]${volumePercent})"`
        } else {
          command = `osascript -e 'set volume output volume ${volumePercent}'`
        }
        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.log('Audio Manager: Error setting system volume:', error.message)
            if (attempt < 3) {
              setTimeout(() => setAndVerify(attempt + 1), 100)
            } else {
              console.log('Audio Manager: Failed to set system volume after 3 attempts')
              this.querySystemVolume().then(resolve).catch(() => resolve(volumePercent))
            }
          } else {
            this.querySystemVolume().then((actualPercent) => {
              if (Math.abs(actualPercent - volumePercent) > 2) {
                if (attempt < 3) {
                  setTimeout(() => setAndVerify(attempt + 1), 100)
                } else {
                  console.log(`Audio Manager: System volume mismatch after 3 attempts (wanted ${volumePercent}%, got ${actualPercent}%)`)
                  resolve(actualPercent)
                }
              } else {
                console.log('Audio Manager: System volume set to:', `${actualPercent}%`)
                resolve(actualPercent)
              }
            }).catch(() => {
              if (attempt < 3) {
                setTimeout(() => setAndVerify(attempt + 1), 100)
              } else {
                console.log('Audio Manager: Failed to verify system volume after 3 attempts')
                resolve(volumePercent)
              }
            })
          }
        })
      }
      setAndVerify()
    })
  }

  // Helper to query the current system volume (returns percent 0-100)
  private querySystemVolume(): Promise<number> {
    return new Promise((resolve, reject) => {
      let command: string
      if (this.platform === 'win32') {
        // Not implemented for Windows
        resolve(Math.round(this.volume * 100))
      } else {
        command = `osascript -e "output volume of (get volume settings)"`
        exec(command, (error, stdout, stderr) => {
          if (error) {
            reject(error)
          } else {
            const val = parseInt(stdout.trim(), 10)
            if (!isNaN(val)) {
              resolve(val)
            } else {
              reject(new Error('Could not parse system volume'))
            }
          }
        })
      }
    })
  }

  getVolume(): number {
    return this.volume
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    console.log('Audio Manager: Mute toggled to:', this.muted)
    
    // Apply mute state to system
    if (this.muted) {
      this.muteSystemAudio()
    } else {
      this.unmuteSystemAudio()
    }
    
    return true
  }

  muteSystemAudio(): void {
    try {
      let command: string
      
      if (this.platform === 'win32') {
        // Windows: Mute system audio
        command = 'powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"'
      } else {
        // macOS: Mute system audio
        command = 'osascript -e "set volume output muted true"'
      }
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log('Audio Manager: Error muting system audio:', error.message)
        } else {
          console.log('Audio Manager: System audio muted')
        }
      })
    } catch (error) {
      console.error('Audio Manager: Error muting system audio:', error)
    }
  }

  unmuteSystemAudio(): void {
    try {
      let command: string
      
      if (this.platform === 'win32') {
        // Windows: Unmute system audio
        command = 'powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"'
      } else {
        // macOS: Unmute system audio
        command = 'osascript -e "set volume output muted false"'
      }
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log('Audio Manager: Error unmuting system audio:', error.message)
        } else {
          console.log('Audio Manager: System audio unmuted')
        }
      })
    } catch (error) {
      console.error('Audio Manager: Error unmuting system audio:', error)
    }
  }

  isMuted(): boolean {
    return this.muted
  }
}

export default AudioManager 