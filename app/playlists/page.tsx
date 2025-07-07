'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Edit, Trash2, Play, Music } from 'lucide-react'
import { Playlist } from '@/types/music'
import { useSettings } from '@/contexts/SettingsContext'
import styles from './page.module.css'

export default function PlaylistsPage(): JSX.Element {
  const router = useRouter()
  const { canPerformAction } = useSettings()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    void loadPlaylists()
  }, [])

  const loadPlaylists = async (): Promise<void> => {
    try {
      const response = await fetch('/api/playlists')
      if (response.ok) {
        const data = await response.json() as Playlist[]
        setPlaylists(data)
      } else {
        console.error('Failed to load playlists')
      }
    } catch (error) {
      console.error('Error loading playlists:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePlaylist = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!newPlaylistName.trim()) return

    if (!canPerformAction('allowCreatePlaylists')) {
      // TODO: Show non-blocking UI for restricted action
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPlaylistName.trim(),
          description: newPlaylistDescription.trim()
        })
      })

      if (response.ok) {
        const newPlaylist = await response.json() as Playlist
        setPlaylists(prev => [...prev, newPlaylist])
        setShowCreateModal(false)
        setNewPlaylistName('')
        setNewPlaylistDescription('')
      } else {
        // TODO: Show non-blocking UI for error
      }
    } catch (error) {
      console.error('Error creating playlist:', error)
      // TODO: Show non-blocking UI for error
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeletePlaylist = async (playlistId: string): Promise<void> => {
    if (!canPerformAction('allowDeletePlaylists')) {
      // TODO: Show non-blocking UI for restricted action
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/playlists/${playlistId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setPlaylists(prev => prev.filter(p => p.id !== playlistId))
        setShowDeleteModal(null)
      } else {
        // TODO: Show non-blocking UI for error
      }
    } catch (error) {
      console.error('Error deleting playlist:', error)
      // TODO: Show non-blocking UI for error
    } finally {
      setIsDeleting(false)
    }
  }

  const handlePlayPlaylist = async (playlist: Playlist): Promise<void> => {
    if (!canPerformAction('allowAddToQueue')) {
      // TODO: Show non-blocking UI for restricted action
      return
    }

    if (playlist.tracks.length === 0) {
      // TODO: Show non-blocking UI for empty playlist
      return
    }

    try {
      // Clear current queue
      await fetch('/api/queue', { method: 'DELETE' })
      
      // Add all tracks from playlist to queue
      for (const playlistTrack of playlist.tracks) {
        await fetch('/api/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: playlistTrack.track.path })
        })
      }

      // Navigate back to main page to see the player
      void router.push('/')
    } catch (error) {
      console.error('Error playing playlist:', error)
      // TODO: Show non-blocking UI for error
    }
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <p>Loading playlists...</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Playlists</h1>
        <button 
          onClick={() => setShowCreateModal(true)}
          className={styles.createButton}
          disabled={!canPerformAction('allowCreatePlaylists')}
          title={!canPerformAction('allowCreatePlaylists') ? 'Creating playlists is restricted in party mode' : 'Create new playlist'}
        >
          <Plus className={styles.plusIcon} />
          New Playlist
        </button>
      </div>

      {playlists.length === 0 ? (
        <div className={styles.emptyState}>
          <Music className={styles.emptyIcon} />
          <h2>No playlists yet</h2>
          <p>Create your first playlist to get started</p>
          <button 
            onClick={() => setShowCreateModal(true)}
            className={styles.createFirstButton}
            disabled={!canPerformAction('allowCreatePlaylists')}
            title={!canPerformAction('allowCreatePlaylists') ? 'Creating playlists is restricted in party mode' : 'Create your first playlist'}
          >
            <Plus className={styles.plusIcon} />
            Create Playlist
          </button>
        </div>
      ) : (
        <div className={styles.playlistsGrid}>
          {playlists.map((playlist) => (
            <div key={playlist.id} className={styles.playlistCard}>
              <div className={styles.playlistHeader}>
                <div className={styles.playlistIcon}>
                  <Music className={styles.musicIcon} />
                </div>
                <div className={styles.playlistInfo}>
                  <h3 className={styles.playlistName}>{playlist.name}</h3>
                  {playlist.description && (
                    <p className={styles.playlistDescription}>{playlist.description}</p>
                  )}
                  <div className={styles.playlistMeta}>
                    <span className={styles.trackCount}>
                      {playlist.trackCount} {playlist.trackCount === 1 ? 'track' : 'tracks'}
                    </span>
                    <span className={styles.createdDate}>
                      Created {formatDate(playlist.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.playlistActions}>
                <button
                  onClick={() => { void handlePlayPlaylist(playlist) }}
                  className={styles.playButton}
                  disabled={playlist.trackCount === 0 || !canPerformAction('allowAddToQueue')}
                  title={
                    playlist.trackCount === 0 
                      ? 'Playlist is empty' 
                      : !canPerformAction('allowAddToQueue')
                      ? 'Adding to queue is restricted in party mode'
                      : 'Play playlist'
                  }
                >
                  <Play className={styles.playIcon} />
                </button>
                <button
                  onClick={() => { void router.push(`/playlists/${playlist.id}`) }}
                  className={styles.editButton}
                  disabled={!canPerformAction('allowEditPlaylists')}
                  title={!canPerformAction('allowEditPlaylists') ? 'Editing playlists is restricted in party mode' : 'Edit playlist'}
                >
                  <Edit className={styles.editIcon} />
                </button>
                <button
                  onClick={() => setShowDeleteModal(playlist.id)}
                  className={styles.deleteButton}
                  disabled={!canPerformAction('allowDeletePlaylists')}
                  title={!canPerformAction('allowDeletePlaylists') ? 'Deleting playlists is restricted in party mode' : 'Delete playlist'}
                >
                  <Trash2 className={styles.deleteIcon} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div 
          className={styles.modalOverlay} 
          onClick={() => setShowCreateModal(false)}
          onKeyDown={e => { if (e.key === 'Escape') setShowCreateModal(false) }}
          tabIndex={0}
          role="button"
        >
          <div 
            className={styles.modal} 
            onClick={(e) => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Escape') setShowCreateModal(false) }}
            tabIndex={0}
            role="button"
          >
            <h2>Create New Playlist</h2>
            <form onSubmit={e => { void handleCreatePlaylist(e) }}>
              <div className={styles.formGroup}>
                <label htmlFor="playlistName">Name *</label>
                <input
                  id="playlistName"
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Enter playlist name"
                  required
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="playlistDescription">Description</label>
                <textarea
                  id="playlistDescription"
                  value={newPlaylistDescription}
                  onChange={(e) => setNewPlaylistDescription(e.target.value)}
                  placeholder="Enter playlist description (optional)"
                  className={styles.textarea}
                  rows={3}
                />
              </div>
              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className={styles.cancelButton}
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.saveButton}
                  disabled={isCreating || !newPlaylistName.trim()}
                >
                  {isCreating ? 'Creating...' : 'Create Playlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div 
          className={styles.modalOverlay} 
          onClick={() => setShowDeleteModal(null)}
          onKeyDown={e => { if (e.key === 'Escape') setShowDeleteModal(null) }}
          tabIndex={0}
          role="button"
        >
          <div 
            className={styles.modal} 
            onClick={(e) => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Escape') setShowDeleteModal(null) }}
            tabIndex={0}
            role="button"
          >
            <h2>Delete Playlist</h2>
            <p>Are you sure you want to delete this playlist? This action cannot be undone.</p>
            <div className={styles.modalActions}>
              <button
                onClick={() => setShowDeleteModal(null)}
                className={styles.cancelButton}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={() => { void handleDeletePlaylist(showDeleteModal) }}
                className={styles.deleteConfirmButton}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 