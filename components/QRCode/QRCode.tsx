'use client'

import React, { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { Smartphone, Copy, Check } from 'lucide-react'
import styles from './QRCode.module.css'

interface QRCodeProps {
  className?: string
}

const QRCodeComponent: React.FC<QRCodeProps> = ({ className }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [currentUrl, setCurrentUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        // Get the current URL from the browser
        const url = window.location.href
        
        // If we're on localhost, try to get the local network IP
        if (url.includes('localhost') || url.includes('127.0.0.1')) {
          try {
            // Get local network information from our API
            const response = await fetch('/api/network-info')
            const data = await response.json()
            
            if (data.localIPs && data.localIPs.length > 0) {
              // Use the first local IP found
              const localIP = data.localIPs[0]
              const localNetworkUrl = url.replace(/localhost:\d+/, `${localIP}:${data.port}`)
              setCurrentUrl(localNetworkUrl)
              
              // Generate QR code for the local network URL
              const qrCode = await QRCode.toDataURL(localNetworkUrl, {
                width: 200,
                margin: 2,
                color: {
                  dark: '#FFD700', // Gold color to match theme
                  light: '#1a1a1a' // Dark background
                }
              })
              setQrDataUrl(qrCode)
            } else {
              // Fallback to current URL if no local IP found
              setCurrentUrl(url)
              const qrCode = await QRCode.toDataURL(url, {
                width: 200,
                margin: 2,
                color: {
                  dark: '#FFD700',
                  light: '#1a1a1a'
                }
              })
              setQrDataUrl(qrCode)
            }
          } catch (error) {
            console.log('Could not get local IP, using current URL')
            setCurrentUrl(url)
            const qrCode = await QRCode.toDataURL(url, {
              width: 200,
              margin: 2,
              color: {
                dark: '#FFD700',
                light: '#1a1a1a'
              }
            })
            setQrDataUrl(qrCode)
          }
        } else {
          // Not on localhost, use current URL
          setCurrentUrl(url)
          const qrCode = await QRCode.toDataURL(url, {
            width: 200,
            margin: 2,
            color: {
              dark: '#FFD700',
              light: '#1a1a1a'
            }
          })
          setQrDataUrl(qrCode)
        }
      } catch (error) {
        console.error('Error generating QR code:', error)
      } finally {
        setIsLoading(false)
      }
    }

    generateQRCode()
  }, [])

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy URL:', error)
    }
  }

  if (isLoading) {
    return (
      <div className={`${styles.container} ${className || ''}`}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Generating QR Code...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <div className={styles.header}>
        <Smartphone className={styles.icon} />
        <h3 className={styles.title}>Scan to Access</h3>
        <p className={styles.subtitle}>Scan this QR code with your phone to access the jukebox</p>
      </div>
      
      <div className={styles.qrSection}>
        {qrDataUrl && (
          <div className={styles.qrCode}>
            <img src={qrDataUrl} alt="QR Code" />
          </div>
        )}
        
        <div className={styles.urlSection}>
          <div className={styles.urlDisplay}>
            <span className={styles.url}>{currentUrl}</span>
            <button 
              onClick={handleCopyUrl}
              className={styles.copyButton}
              title="Copy URL"
            >
              {copied ? (
                <Check className={styles.copyIcon} />
              ) : (
                <Copy className={styles.copyIcon} />
              )}
            </button>
          </div>
          {copied && (
            <p className={styles.copiedMessage}>URL copied to clipboard!</p>
          )}
        </div>
      </div>
      
      <div className={styles.instructions}>
        <h4>How to use:</h4>
        <ol>
          <li>Open your phone's camera app</li>
          <li>Point it at the QR code above</li>
          <li>Tap the notification that appears</li>
          <li>Enjoy the jukebox on your phone!</li>
        </ol>
        <p className={styles.note}>
          <strong>Note:</strong> Make sure your phone is connected to the same WiFi network as this computer.
        </p>
      </div>
    </div>
  )
}

export default QRCodeComponent 