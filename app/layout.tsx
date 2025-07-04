import React from 'react'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import styles from './layout.module.css'
import { SearchProvider } from '@/contexts/SearchContext'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ToastProvider } from '@/contexts/ToastContext'
import AppShell from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'Jukebox 2.0',
  description: 'A modern jukebox application for your local music collection',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <SettingsProvider>
          <ThemeProvider>
            <SearchProvider>
              <ToastProvider>
                <AppShell>{children}</AppShell>
              </ToastProvider>
            </SearchProvider>
          </ThemeProvider>
        </SettingsProvider>
      </body>
    </html>
  )
} 