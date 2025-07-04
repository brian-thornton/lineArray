const player = require('play-sound')({
    // Windows-specific configuration
    players: process.platform === 'win32' ? ['mplayer', 'mpg123', 'mpg321'] : undefined
});

const { exec } = require('child_process');

class AudioManager {
    constructor() {
        this.currentProcess = null;
        this.isPlaying = false;
        this.currentFile = null;
        this.platform = process.platform;
        this.volume = 1.0;
        this.isMuted = false;
        this.playbackStartTime = null;
        this.estimatedDuration = 0; // in seconds
        this.wasPlayingBeforeKill = false; // Track if we were playing before process was killed
    }

    async playFile(filePath) {
        try {
            console.log('Audio Manager: Playing file:', filePath);
            
            // If we're already playing this file, don't restart
            if (this.currentFile === filePath && this.isPlaying && this.currentProcess) {
                console.log('Audio Manager: Already playing this file, skipping restart');
                return true;
            }
            
            // Stop any currently playing audio
            await this.stop();
            
            // Estimate duration based on file size (rough approximation)
            this.estimatedDuration = this.estimateDuration(filePath);
            this.playbackStartTime = Date.now();
            
            console.log('Audio Manager: Starting playback with play-sound');
            
            // Start playing the new file
            this.currentProcess = player.play(filePath, (err) => {
                if (err) {
                    console.error('Audio Manager: Error playing file:', err);
                    this.isPlaying = false;
                    this.currentFile = null;
                    this.playbackStartTime = null;
                    this.wasPlayingBeforeKill = false;
                } else {
                    console.log('Audio Manager: Finished playing:', filePath);
                    this.isPlaying = false;
                    this.currentFile = null;
                    this.playbackStartTime = null;
                    this.wasPlayingBeforeKill = false;
                }
            });
            
            this.isPlaying = true;
            this.currentFile = filePath;
            this.wasPlayingBeforeKill = false; // Reset flag when starting new playback
            
            console.log('Audio Manager: Now playing:', filePath, 'isPlaying:', this.isPlaying, 'currentProcess:', !!this.currentProcess);
            
            // Add a small delay to ensure the audio process has started
            await new Promise(resolve => setTimeout(resolve, 100));
            
            console.log('Audio Manager: After delay - isPlaying:', this.isPlaying, 'currentProcess:', !!this.currentProcess);
            return true;
        } catch (error) {
            console.error('Audio Manager: Error playing file:', error);
            this.isPlaying = false;
            this.currentFile = null;
            this.playbackStartTime = null;
            this.wasPlayingBeforeKill = false;
            return false;
        }
    }

    estimateDuration(filePath) {
        // Rough estimation based on file size
        // This is a very basic approximation - in a real app you'd use metadata
        try {
            const fs = require('fs');
            const stats = fs.statSync(filePath);
            const sizeInMB = stats.size / (1024 * 1024);
            // Assume roughly 1MB per minute for MP3
            return Math.max(30, Math.min(600, sizeInMB * 60)); // Between 30 seconds and 10 minutes
        } catch (error) {
            return 180; // Default 3 minutes
        }
    }

    getPlaybackProgress() {
        if (!this.isPlaying || !this.playbackStartTime || !this.estimatedDuration) {
            return 0;
        }
        
        const elapsed = (Date.now() - this.playbackStartTime) / 1000;
        const progress = Math.min(1, elapsed / this.estimatedDuration);
        return progress;
    }

    isTrackFinished() {
        if (!this.isPlaying || !this.playbackStartTime || !this.estimatedDuration) {
            return false;
        }
        
        const elapsed = (Date.now() - this.playbackStartTime) / 1000;
        return elapsed >= this.estimatedDuration;
    }

    async stop() {
        try {
            console.log('Audio Manager: Stopping all audio playback...');
            
            // Kill the current process if it exists
            if (this.currentProcess) {
                try {
                    if (this.platform === 'win32') {
                        this.currentProcess.kill('SIGTERM');
                    } else {
                        this.currentProcess.kill();
                    }
                } catch (e) {
                    console.log('Audio Manager: Error killing current process:', e.message);
                }
                this.currentProcess = null;
            }
            
            // Kill all audio processes aggressively
            await this.killAllAudioProcesses();
            
            this.isPlaying = false;
            this.currentFile = null;
            this.playbackStartTime = null;
            console.log('Audio Manager: Playback stopped');
            return true;
        } catch (error) {
            console.error('Audio Manager: Error stopping playback:', error);
            return false;
        }
    }

    async killAllAudioProcesses() {
        return new Promise((resolve) => {
            let command;
            
            if (this.platform === 'win32') {
                // Windows: Kill audio processes
                command = 'taskkill /f /im mplayer.exe /im mpg123.exe /im mpg321.exe /im afplay.exe 2>nul || echo "No audio processes found"';
            } else {
                // macOS/Linux: Kill audio processes
                command = 'pkill -f afplay; pkill -f mpg123; pkill -f mpg321; pkill -f mplayer; pkill -f "play-sound" || echo "No audio processes found"';
            }
            
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.log('Audio Manager: Error killing audio processes:', error.message);
                } else {
                    console.log('Audio Manager: Killed audio processes:', stdout);
                }
                resolve();
            });
        });
    }

    async pause() {
        try {
            if (this.currentProcess) {
                // Windows-compatible pause
                if (this.platform === 'win32') {
                    this.currentProcess.kill('SIGSTOP');
                } else {
                    this.currentProcess.kill('SIGSTOP');
                }
                this.isPlaying = false;
                console.log('Audio Manager: Playback paused');
            }
            return true;
        } catch (error) {
            console.error('Audio Manager: Error pausing playback:', error);
            return false;
        }
    }

    async resume() {
        try {
            if (this.currentProcess) {
                // Windows-compatible resume
                if (this.platform === 'win32') {
                    this.currentProcess.kill('SIGCONT');
                } else {
                    this.currentProcess.kill('SIGCONT');
                }
                this.isPlaying = true;
                console.log('Audio Manager: Playback resumed');
            }
            return true;
        } catch (error) {
            console.error('Audio Manager: Error resuming playback:', error);
            return false;
        }
    }

    getStatus() {
        // Check if our process is still alive
        if (this.currentProcess && this.isPlaying) {
            try {
                // Try to check if process is still running (this might throw if process is dead)
                if (this.currentProcess.killed !== undefined && this.currentProcess.killed) {
                    console.log('Audio Manager: Detected killed process, resetting state');
                    this.wasPlayingBeforeKill = true; // Mark that we were playing before kill
                    this.resetState();
                }
            } catch (error) {
                console.log('Audio Manager: Process check failed, assuming killed:', error.message);
                this.wasPlayingBeforeKill = true; // Mark that we were playing before kill
                this.resetState();
            }
        }
        
        return {
            isPlaying: this.isPlaying,
            currentFile: this.currentFile,
            hasProcess: !!this.currentProcess,
            platform: this.platform,
            wasPlayingBeforeKill: this.wasPlayingBeforeKill
        };
    }

    // Reset state when process is killed externally (e.g., during recompile)
    resetState() {
        console.log('Audio Manager: Resetting state due to external process kill');
        this.currentProcess = null;
        this.isPlaying = false;
        // Don't clear currentFile - we want to preserve what should be playing
        this.playbackStartTime = null;
        // Don't clear wasPlayingBeforeKill - we want to preserve this flag for restart logic
    }

    // Check if we need to restart playback after a process kill
    async checkAndRestart() {
        if (this.currentFile && !this.isPlaying && !this.currentProcess) {
            console.log('Audio Manager: Detected killed process, restarting playback for:', this.currentFile);
            return await this.playFile(this.currentFile);
        }
        return false;
    }

    // Set current file without starting playback (for state restoration)
    setCurrentFile(filePath) {
        this.currentFile = filePath;
        console.log('Audio Manager: Set current file to:', filePath);
    }

    getCurrentSong() {
        return {
            file: this.currentFile,
            title: this.currentFile ? this.currentFile.split(/[\/\\]/).pop() : null
        };
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.isMuted = this.volume === 0;
        console.log('Audio Manager: Volume set to:', this.volume);
        
        // Apply volume to system audio
        this.applySystemVolume();
        return true;
    }

    applySystemVolume() {
        try {
            let command;
            const volumePercent = Math.round(this.volume * 100);
            
            if (this.platform === 'win32') {
                // Windows: Use PowerShell to set system volume
                command = `powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]${volumePercent})"`;
            } else {
                // macOS: Use osascript to set system volume
                command = `osascript -e 'set volume output volume ${volumePercent}'`;
            }
            
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.log('Audio Manager: Error setting system volume:', error.message);
                } else {
                    console.log('Audio Manager: System volume set to:', volumePercent + '%');
                }
            });
        } catch (error) {
            console.error('Audio Manager: Error applying system volume:', error);
        }
    }

    getVolume() {
        return this.volume;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        console.log('Audio Manager: Mute toggled to:', this.isMuted);
        
        // Apply mute state to system
        if (this.isMuted) {
            this.muteSystemAudio();
        } else {
            this.unmuteSystemAudio();
        }
        
        return true;
    }

    muteSystemAudio() {
        try {
            let command;
            
            if (this.platform === 'win32') {
                // Windows: Mute system audio
                command = 'powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"';
            } else {
                // macOS: Mute system audio
                command = 'osascript -e "set volume output muted true"';
            }
            
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.log('Audio Manager: Error muting system audio:', error.message);
                } else {
                    console.log('Audio Manager: System audio muted');
                }
            });
        } catch (error) {
            console.error('Audio Manager: Error muting system audio:', error);
        }
    }

    unmuteSystemAudio() {
        try {
            let command;
            
            if (this.platform === 'win32') {
                // Windows: Unmute system audio
                command = 'powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"';
            } else {
                // macOS: Unmute system audio
                command = 'osascript -e "set volume output muted false"';
            }
            
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.log('Audio Manager: Error unmuting system audio:', error.message);
                } else {
                    console.log('Audio Manager: System audio unmuted');
                }
            });
        } catch (error) {
            console.error('Audio Manager: Error unmuting system audio:', error);
        }
    }

    isMuted() {
        return this.isMuted;
    }
}

module.exports = AudioManager; 