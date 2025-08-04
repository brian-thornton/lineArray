import React from 'react'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { SearchProvider } from '@/contexts/SearchContext'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { LibraryProvider } from '@/contexts/LibraryContext'
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
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#0f0f23" />
      </head>
      <body>
        <SettingsProvider>
          <ThemeProvider>
            <SearchProvider>
              <ToastProvider>
                <LibraryProvider>
                  <AppShell>{children}</AppShell>
                </LibraryProvider>
              </ToastProvider>
            </SearchProvider>
          </ThemeProvider>
        </SettingsProvider>
      </body>
    </html>
  )
} 