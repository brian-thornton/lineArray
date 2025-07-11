import fs from 'fs'
import path from 'path'
import { LogLevel, type LogEntry } from './types'

export { LogLevel, type LogEntry }

class ServerLogger {
  private logFilePath: string
  private maxLogEntries = 5000
  private logBuffer: LogEntry[] = []
  private isInitialized = false

  constructor() {
    const dataDir = path.join(process.cwd(), 'data')
    this.logFilePath = path.join(dataDir, 'jukebox.log')
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    // Only create the log file if it doesn't exist
    if (!fs.existsSync(this.logFilePath)) {
      fs.writeFileSync(this.logFilePath, '')
    }
    this.isInitialized = true
    this.info('Logger initialized', 'Logger')
  }

  private writeToFile(entry: LogEntry): void {
    if (!this.isInitialized) return
    try {
      const logLine = JSON.stringify(entry) + '\n'
      fs.appendFileSync(this.logFilePath, logLine)
      this.logBuffer.push(entry)
      if (this.logBuffer.length > this.maxLogEntries) {
        this.rotateLogs()
      }
    } catch (error) {
      console.error('Failed to write to log file:', error)
    }
  }

  private rotateLogs(): void {
    try {
      this.logBuffer = this.logBuffer.slice(-this.maxLogEntries)
      const logContent = this.logBuffer.map(entry => JSON.stringify(entry)).join('\n') + '\n'
      fs.writeFileSync(this.logFilePath, logContent)
    } catch (error) {
      console.error('Failed to rotate logs:', error)
    }
  }

  private log(level: LogLevel, message: string, context?: string, data?: unknown): void {
    let safeData: string | Record<string, unknown> | undefined = undefined;
    if (typeof data === 'string' || (typeof data === 'object' && data !== null)) {
      safeData = data as string | Record<string, unknown>;
    } else if (typeof data !== 'undefined') {
      safeData = String(data);
    }
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data: safeData
    }
    this.writeToFile(entry)
  }

  debug(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, context, data)
  }

  info(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, context, data)
  }

  warn(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, context, data)
  }

  error(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, context, data)
  }

  getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let filteredLogs = this.logBuffer
    if (level) {
      filteredLogs = filteredLogs.filter(entry => entry.level === level)
    }
    filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    if (limit) {
      filteredLogs = filteredLogs.slice(0, limit)
    }
    return filteredLogs
  }

  clearLogs(): void {
    try {
      this.logBuffer = []
      fs.writeFileSync(this.logFilePath, '')
      this.info('Logs cleared', 'Logger')
    } catch (error) {
      console.error('Failed to clear logs:', error)
    }
  }

  getLogStats(): { total: number; byLevel: Record<LogLevel, number> } {
    const byLevel = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0
    }
    this.logBuffer.forEach(entry => {
      byLevel[entry.level]++
    })
    return {
      total: this.logBuffer.length,
      byLevel
    }
  }
}

const serverLogger = new ServerLogger()

export default serverLogger 