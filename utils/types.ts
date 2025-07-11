export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: string
  data?: string | Record<string, unknown>
}

export interface LogStats {
  total: number
  debug: number
  info: number
  warn: number
  error: number
} 