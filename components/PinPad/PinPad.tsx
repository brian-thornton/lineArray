'use client'

import React from 'react'
import styles from './PinPad.module.css'

interface PinPadProps {
  pin: string
  onPinChange: (pin: string) => void
  maxLength?: number
  disabled?: boolean
}

export default function PinPad({ pin, onPinChange, maxLength = 6, disabled = false }: PinPadProps) {
  const handleNumberClick = (number: string) => {
    if (disabled) return
    if (pin.length < maxLength) {
      onPinChange(pin + number)
    }
  }

  const handleDelete = () => {
    if (disabled) return
    onPinChange(pin.slice(0, -1))
  }

  const handleClear = () => {
    if (disabled) return
    onPinChange('')
  }

  const numbers = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', '']
  ]

  return (
    <div className={styles.pinPadContainer}>
      {/* PIN Display */}
      <div className={styles.pinDisplay}>
        {Array.from({ length: maxLength }, (_, i) => (
          <div key={i} className={`${styles.pinDot} ${i < pin.length ? styles.filled : ''}`}>
            {i < pin.length ? '•' : ''}
          </div>
        ))}
      </div>

      {/* Number Pad */}
      <div className={styles.numberPad}>
        {numbers.map((row, rowIndex) => (
          <div key={rowIndex} className={styles.row}>
            {row.map((number, colIndex) => {
              if (number === '') {
                return <div key={colIndex} className={styles.emptySpace} />
              }
              
              return (
                <button
                  key={colIndex}
                  className={`${styles.numberButton} ${number === '0' ? styles.zeroButton : ''}`}
                  onClick={() => handleNumberClick(number)}
                  disabled={disabled}
                  type="button"
                >
                  {number}
                </button>
              )
            })}
          </div>
        ))}
        
        {/* Action Buttons */}
        <div className={styles.actionRow}>
          <button
            className={`${styles.actionButton} ${styles.clearButton}`}
            onClick={handleClear}
            disabled={disabled || pin.length === 0}
            type="button"
          >
            Clear
          </button>
          <button
            className={`${styles.actionButton} ${styles.deleteButton}`}
            onClick={handleDelete}
            disabled={disabled || pin.length === 0}
            type="button"
          >
            ←
          </button>
        </div>
      </div>
    </div>
  )
} 