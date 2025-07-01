'use client'

import React, { useState, useEffect } from 'react'
import { X, Plus, Music } from 'lucide-react'
import { Playlist } from '../../types/music'
import styles from './PlaylistModal.module.css'

interface PlaylistModalProps {
  isOpen: boolean
  onClose: () => void
  selectedTracks: string[]
  onAddToPlaylist: (playlistId: string, trackPaths: string[]) => void
}

export default function PlaylistModal({ 
  isOpen, 
  onClose, 
  selectedTracks, 
  onAddToPlaylist 
}: PlaylistModalProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadPlaylists()
    }
  }, [isOpen])

  const loadPlaylists = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/playlists')
      if (response.ok) {
        const data = await response.json()
        setPlaylists(Array.isArray(data) ? data : [])
      } else {
        console.error('Failed to load playlists')
        setPlaylists([])
      }
    } catch (error) {
      console.error('Error loading playlists:', error)
      setPlaylists([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return

    setCreating(true)
    try {
      const response = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlaylistName.trim() }),
      })

      if (response.ok) {
        const newPlaylist = await response.json()
        setPlaylists(prev => [...prev, newPlaylist])
        setNewPlaylistName('')
        setShowCreateForm(false)
        
        // Add tracks to the new playlist
        onAddToPlaylist(newPlaylist.id, selectedTracks)
        onClose()
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to create playlist')
      }
    } catch (error) {
      console.error('Error creating playlist:', error)
      alert('Failed to create playlist. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleAddToExistingPlaylist = async (playlistId: string) => {
    try {
      onAddToPlaylist(playlistId, selectedTracks)
      onClose()
    } catch (error) {
      console.error('Error adding to playlist:', error)
      alert('Failed to add tracks to playlist. Please try again.')
    }
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Add to Playlist</h3>
          <button onClick={onClose} className={styles.closeButton}>
            <X className={styles.closeIcon} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.summary}>
            <p>Adding {selectedTracks.length} track{selectedTracks.length !== 1 ? 's' : ''} to playlist</p>
          </div>

          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Loading playlists...</p>
            </div>
          ) : (
            <>
              <div className={styles.existingPlaylists}>
                <h4>Existing Playlists</h4>
                {playlists.length === 0 ? (
                  <p className={styles.emptyMessage}>No playlists found</p>
                ) : (
                  <div className={styles.playlistList}>
                    {playlists.map((playlist) => (
                      <button
                        key={playlist.id}
                        onClick={() => handleAddToExistingPlaylist(playlist.id)}
                        className={styles.playlistItem}
                      >
                        <Music className={styles.playlistIcon} />
                        <div className={styles.playlistInfo}>
                          <span className={styles.playlistName}>{playlist.name}</span>
                          <span className={styles.trackCount}>
                            {playlist.tracks.length} track{playlist.tracks.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.divider}>
                <span>or</span>
              </div>

              <div className={styles.createSection}>
                {!showCreateForm ? (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className={styles.createButton}
                  >
                    <Plus className={styles.plusIcon} />
                    Create New Playlist
                  </button>
                ) : (
                  <div className={styles.createForm}>
                    <input
                      type="text"
                      placeholder="Playlist name"
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      className={styles.nameInput}
                      autoFocus
                    />
                    <div className={styles.formActions}>
                      <button
                        onClick={handleCreatePlaylist}
                        disabled={!newPlaylistName.trim() || creating}
                        className={styles.saveButton}
                      >
                        {creating ? 'Creating...' : 'Create & Add'}
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateForm(false)
                          setNewPlaylistName('')
                        }}
                        className={styles.cancelButton}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
} 