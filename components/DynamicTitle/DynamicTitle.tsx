"use client"

import { useEffect } from 'react'
import { useSettings } from '@/contexts/SettingsContext'

export default function DynamicTitle(): null {
  const { settings } = useSettings()

  useEffect(() => {
    document.title = settings.jukeboxName
  }, [settings.jukeboxName])

  return null
} 