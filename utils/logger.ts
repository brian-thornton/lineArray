// Import types from types file
import { LogLevel, type LogEntry } from './types'

// Re-export types
export { LogLevel, type LogEntry }

// Client-safe logger interface
class ClientLogger {
  debug(message: string, context?: string, data?: unknown): void {
    // Client-side logging is disabled for security
  }

  info(message: string, context?: string, data?: unknown): void {
    // Client-side logging is disabled for security
  }

  warn(message: string, context?: string, data?: unknown): void {
    // Client-side logging is disabled for security
  }

  error(message: string, context?: string, data?: unknown): void {
    // Client-side logging is disabled for security
  }

  getLogs(): LogEntry[] {
    return []
  }

  clearLogs(): void {
    // Client-side clearing is disabled for security
  }

  getLogStats(): { total: number; byLevel: Record<LogLevel, number> } {
    return {
      total: 0,
      byLevel: {
        [LogLevel.DEBUG]: 0,
        [LogLevel.INFO]: 0,
        [LogLevel.WARN]: 0,
        [LogLevel.ERROR]: 0
      }
    }
  }
}

// Create client-safe logger instance
const logger = new ClientLogger()

export default logger 