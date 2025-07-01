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
    }

    async playFile(filePath) {
        try {
            console.log('Audio Manager: Playing file:', filePath);
            
            // Stop any currently playing audio
            await this.stop();
            
            // Start playing the new file
            this.currentProcess = player.play(filePath, (err) => {
                if (err) {
                    console.error('Audio Manager: Error playing file:', err);
                    this.isPlaying = false;
                    this.currentFile = null;
                } else {
                    console.log('Audio Manager: Finished playing:', filePath);
                    this.isPlaying = false;
                    this.currentFile = null;
                }
            });
            
            this.isPlaying = true;
            this.currentFile = filePath;
            
            console.log('Audio Manager: Now playing:', filePath);
            return true;
        } catch (error) {
            console.error('Audio Manager: Error playing file:', error);
            return false;
        }
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
        return {
            isPlaying: this.isPlaying,
            currentFile: this.currentFile,
            hasProcess: !!this.currentProcess,
            platform: this.platform
        };
    }

    getCurrentSong() {
        return {
            file: this.currentFile,
            title: this.currentFile ? this.currentFile.split(/[\/\\]/).pop() : null
        };
    }
}

module.exports = AudioManager; 