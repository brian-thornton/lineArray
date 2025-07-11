'use client'

import React, { useState, useEffect } from 'react'
import { LogLevel, LogEntry } from '@/utils/types'
import styles from './LogsViewer.module.css'

interface LogsViewerProps {
  className?: string
}

function LogsViewer({ className }: LogsViewerProps): JSX.Element {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'ALL'>('ALL')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = async (level?: LogLevel): Promise<void> => {
    setIsLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams()
      if (level) {
        params.append('level', level)
      }
      params.append('limit', '1000') // Get last 1000 logs
      
      const response = await fetch(`/api/logs?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch logs')
      }
      
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data: { logs?: LogEntry[] } = await response.json();
      if (data && Array.isArray(data.logs)) {
        setLogs(data.logs);
      } else {
        setLogs([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
    } finally {
      setIsLoading(false)
    }
  }

  const clearLogs = async (): Promise<void> => {
    try {
      const response = await fetch('/api/logs', { method: 'DELETE' })
      if (!response.ok) {
        throw new Error('Failed to clear logs')
      }
      
      // Refresh logs after clearing
      await fetchLogs(selectedLevel === 'ALL' ? undefined : selectedLevel)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear logs')
    }
  }

  useEffect(() => {
    void fetchLogs()
  }, [])

  const handleLevelChange = (level: LogLevel | 'ALL'): void => {
    setSelectedLevel(level)
    void fetchLogs(level === 'ALL' ? undefined : level)
  }

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString()
  }

  const getLevelColor = (level: LogLevel): string => {
    switch (level) {
      case LogLevel.DEBUG:
        return styles.debug
      case LogLevel.INFO:
        return styles.info
      case LogLevel.WARN:
        return styles.warn
      case LogLevel.ERROR:
        return styles.error
      default:
        return ''
    }
  }

  const getLevelIcon = (level: LogLevel): string => {
    switch (level) {
      case LogLevel.DEBUG:
        return '🔍'
      case LogLevel.INFO:
        return 'ℹ️'
      case LogLevel.WARN:
        return '⚠️'
      case LogLevel.ERROR:
        return '❌'
      default:
        return '📝'
    }
  }

  return (
    <div className={`${styles.container} ${className ?? ''}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>System Logs</h3>
        <div className={styles.controls}>
          <button
            onClick={() => { void clearLogs(); }}
            className={styles.clearButton}
            disabled={isLoading}
            title="Clear all logs"
          >
            🗑️ Clear Logs
          </button>
          <button
            onClick={() => { void fetchLogs(selectedLevel === 'ALL' ? undefined : selectedLevel); }}
            className={styles.refreshButton}
            disabled={isLoading}
            title="Refresh logs"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.levelFilter}>
          <span className={styles.filterLabel}>Filter by level:</span>
          <div className={styles.levelButtons}>
            {(['ALL', ...Object.values(LogLevel)] as const).map((level) => (
              <button
                key={level}
                onClick={() => { handleLevelChange(level); }}
                className={`${styles.levelButton} ${selectedLevel === level ? styles.active : ''}`}
                disabled={isLoading}
                title={level === 'ALL' ? 'Show all logs' : `Show only ${level} logs`}
              >
                {level === 'ALL' ? '📋' : getLevelIcon(level as LogLevel)} {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          Error: {error}
        </div>
      )}

      <div className={styles.logsContainer}>
        {isLoading ? (
          <div className={styles.loading}>Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className={styles.empty}>No logs found</div>
        ) : (
          <div className={styles.logs}>
            {logs.map((log) => {
              const logKey = `${log.timestamp}-${log.message}-${log.level}-${log.context ?? 'no-context'}`
              return (
                <div key={logKey} className={styles.logEntry}>
                  <div className={styles.logHeader}>
                    <span className={`${styles.logLevel} ${getLevelColor(log.level)}`}>
                      {getLevelIcon(log.level)} {log.level}
                    </span>
                    <span className={styles.logTimestamp}>
                      🕒 {formatTimestamp(log.timestamp)}
                    </span>
                    {log.context && (
                      <span className={styles.logContext}>
                        🏷️ {log.context}
                      </span>
                    )}
                  </div>
                  <div className={styles.logMessage}>
                    {log.message}
                  </div>
                  {log.data && (
                    <div className={styles.logData}>
                      <pre>
                        {typeof log.data === 'string' 
                          ? log.data 
                          : JSON.stringify(log.data, null, 2)
                        }
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default LogsViewer 