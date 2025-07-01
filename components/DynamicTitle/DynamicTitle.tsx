'use client'

import React, { useEffect } from 'react'
import { useSettings } from '@/contexts/SettingsContext'

export default function DynamicTitle() {
  const { settings } = useSettings()

  useEffect(() => {
    document.title = settings.jukeboxName
  }, [settings.jukeboxName])

  return null
} 