'use client'

import React, { useState, useEffect } from 'react'
import { CheckCircle, Info, AlertTriangle, XCircle, X } from 'lucide-react'
import styles from './Toast.module.css'

interface ToastProps {
  message: string
  type?: 'success' | 'info' | 'warning' | 'error'
  duration?: number
  onClose?: () => void
}

function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps): JSX.Element {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => {
        onClose?.()
      }, 300) // Wait for fade out animation
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const handleClose = (): void => {
    setIsVisible(false)
    setTimeout(() => {
      onClose?.()
    }, 300)
  }

  const getIcon = (): JSX.Element => {
    switch (type) {
      case 'success':
        return <CheckCircle className={styles.icon} />
      case 'warning':
        return <AlertTriangle className={styles.icon} />
      case 'error':
        return <XCircle className={styles.icon} />
      default:
        return <Info className={styles.icon} />
    }
  }

  return (
    <div className={`${styles.toast} ${styles[type]} ${isVisible ? styles.visible : styles.hidden}`}>
      <div className={styles.content}>
        <div className={styles.iconContainer}>
          {getIcon()}
        </div>
        <span className={styles.message}>{message}</span>
        <button onClick={handleClose} className={styles.closeButton} aria-label="Close">
          <X className={styles.closeIcon} />
        </button>
      </div>
      <div className={styles.progressBar} />
    </div>
  )
}

export default Toast 