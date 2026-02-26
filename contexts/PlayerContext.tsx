'use client'

import React, { createContext, useContext, useState } from 'react'

interface PlayerContextValue {
  currentTrackPath: string | null
  setCurrentTrackPath: (path: string | null) => void
}

const PlayerContext = createContext<PlayerContextValue>({
  currentTrackPath: null,
  setCurrentTrackPath: () => {},
})

export function PlayerProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [currentTrackPath, setCurrentTrackPath] = useState<string | null>(null)

  return (
    <PlayerContext.Provider value={{ currentTrackPath, setCurrentTrackPath }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer(): PlayerContextValue {
  return useContext(PlayerContext)
}
