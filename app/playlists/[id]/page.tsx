'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Play, Edit, Save, X, Trash2, Plus, Music, GripVertical } from 'lucide-react'
import { Playlist } from '@/types/music'
import { useSettings } from '@/contexts/SettingsContext'
import { useSearch } from '@/contexts/SearchContext'
import { useToast } from '@/contexts/ToastContext'
import SearchResults from '@/components/SearchResults/SearchResults'
import styles from './page.module.css'

export default function PlaylistDetailPage({ params }: { params: { id: string } }): JSX.Element {
  const router = useRouter()
  const { canPerformAction } = useSettings()
  const { searchQuery, searchResults, isSearching, addTrackToQueue, hideKeyboard } = useSearch()
  const { showToast } = useToast()
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [draggedTrack, setDraggedTrack] = useState<string | null>(null)

  useEffect(() => {
    void loadPlaylist()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const loadPlaylist = async (): Promise<void> => {
    try {
      const response = await fetch(`/api/playlists/${params.id}`)
      if (response.ok) {
        const data = await response.json() as Playlist
        setPlaylist(data)
        setEditName(data.name)
        setEditDescription(data.description ?? '')
      } else {
        console.error('Failed to load playlist')
        void router.push('/playlists')
      }
    } catch (error) {
      console.error('Error loading playlist:', error)
      void router.push('/playlists')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveEdit = async (): Promise<void> => {
    if (!playlist) return

    if (!canPerformAction('allowEditPlaylists')) {
      // TODO: Show non-blocking UI for restricted action
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/playlists/${playlist.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim()
        })
      })

      if (response.ok) {
        const updatedPlaylist = await response.json() as Playlist
        setPlaylist(updatedPlaylist)
        setIsEditing(false)
      } else {
        // TODO: Show non-blocking UI for error
      }
    } catch (error) {
      console.error('Error updating playlist:', error)
      // TODO: Show non-blocking UI for error
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePlaylist = async (): Promise<void> => {
    if (!playlist) return

    if (!canPerformAction('allowDeletePlaylists')) {
      // TODO: Show non-blocking UI for restricted action
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/playlists/${playlist.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        void router.push('/playlists')
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

  const handleRemoveTrack = async (trackId: string): Promise<void> => {
    if (!playlist) return

    if (!canPerformAction('allowEditPlaylists')) {
      // TODO: Show non-blocking UI for restricted action
      return
    }

    try {
      const response = await fetch(`/api/playlists/${playlist.id}/tracks/${trackId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Reload playlist to get updated data
        void loadPlaylist()
      } else {
        // TODO: Show non-blocking UI for error
      }
    } catch (error) {
      console.error('Error removing track:', error)
      // TODO: Show non-blocking UI for error
    }
  }

  const handlePlayPlaylist = async (): Promise<void> => {
    if (!canPerformAction('allowAddToQueue')) {
      // TODO: Show non-blocking UI for restricted action
      return
    }

    if (!playlist || playlist.tracks.length === 0) {
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
      hideKeyboard()
    } catch (error) {
      console.error('Error playing playlist:', error)
      // TODO: Show non-blocking UI for error
    }
  }

  const handleTrackClick = async (path: string): Promise<void> => {
    await addTrackToQueue(path)
    hideKeyboard()
    
    // Find the track title for the toast
    const track = searchResults.find(result => result.path === path)
    if (track) {
      showToast(`Added "${track.title}" to queue`, 'success')
    }
  }

  const handleDragStart = (e: React.DragEvent, trackId: string): void => {
    setDraggedTrack(trackId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, targetTrackId: string): Promise<void> => {
    e.preventDefault()
    
    if (!draggedTrack || draggedTrack === targetTrackId) {
      setDraggedTrack(null)
      return
    }

    if (!canPerformAction('allowEditPlaylists')) {
      // TODO: Show non-blocking UI for restricted action
      setDraggedTrack(null)
      return
    }

    try {
      const response = await fetch(`/api/playlists/${playlist?.id}/tracks/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draggedTrackId: draggedTrack,
          targetTrackId
        })
      })

      if (response.ok) {
        void loadPlaylist()
      } else {
        console.error('Failed to reorder tracks')
      }
    } catch (error) {
      console.error('Error reordering tracks:', error)
    } finally {
      setDraggedTrack(null)
    }
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <p>Loading playlist...</p>
      </div>
    )
  }

  if (!playlist) {
    return (
      <div className={styles.errorContainer}>
        <h2>Playlist not found</h2>
        <button onClick={() => router.push('/playlists')} className={styles.backButton}>
          <ArrowLeft className={styles.backIcon} />
          Back to Playlists
        </button>
      </div>
    )
  }

  return (
    searchQuery ? (
      <div className={styles.container}>
        <SearchResults 
          results={searchResults}
          onTrackClick={path => { void handleTrackClick(path); }}
          isLoading={isSearching}
        />
      </div>
    ) : (
      <div className={styles.container}>
        <div className={styles.header}>
          <button onClick={() => router.push('/playlists')} className={styles.backButton}>
            <ArrowLeft className={styles.backIcon} />
            Back to Playlists
          </button>
        </div>

        <div className={styles.playlistInfo}>
          <div className={styles.playlistHeader}>
            <div className={styles.playlistIcon}>
              <Music className={styles.musicIcon} />
            </div>
            <div className={styles.playlistDetails}>
              {isEditing ? (
                <div className={styles.editForm}>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={styles.editInput}
                    placeholder="Playlist name"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className={styles.editTextarea}
                    placeholder="Playlist description (optional)"
                    rows={2}
                  />
                </div>
              ) : (
                <div>
                  <h1 className={styles.playlistName}>{playlist.name}</h1>
                  {playlist.description ?? "No description"}
                </div>
              )}
              <div className={styles.playlistMeta}>
                <span className={styles.trackCount}>
                  {playlist.trackCount} {playlist.trackCount === 1 ? 'track' : 'tracks'}
                </span>
                <span className={styles.createdDate}>
                  Created {formatDate(playlist.createdAt)}
                </span>
                <span className={styles.updatedDate}>
                  Updated {formatDate(playlist.updatedAt)}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.playlistActions}>
            {isEditing ? (
              <>
                <button
                  onClick={() => { void handleSaveEdit() }}
                  className={styles.saveButton}
                  disabled={isSaving || !editName.trim()}
                >
                  <Save className={styles.saveIcon} />
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false)
                    setEditName(playlist.name)
                    setEditDescription(playlist.description ?? '')
                  }}
                  className={styles.cancelButton}
                  disabled={isSaving}
                >
                  <X className={styles.cancelIcon} />
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { void handlePlayPlaylist() }}
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
                  Play Playlist
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setIsEditing(true) }}
                  tabIndex={0}
                  className={styles.editButton}
                  disabled={!canPerformAction('allowEditPlaylists')}
                  title={!canPerformAction('allowEditPlaylists') ? 'Editing playlists is restricted in party mode' : 'Edit playlist'}
                >
                  <Edit className={styles.editIcon} />
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowDeleteModal(true) }}
                  tabIndex={0}
                  className={styles.deleteButton}
                  disabled={!canPerformAction('allowDeletePlaylists')}
                  title={!canPerformAction('allowDeletePlaylists') ? 'Deleting playlists is restricted in party mode' : 'Delete playlist'}
                >
                  <Trash2 className={styles.deleteIcon} />
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        <div className={styles.tracksSection}>
          <div className={styles.tracksHeader}>
            <h2 className={styles.tracksTitle}>Tracks</h2>
            <button
              onClick={() => router.push('/')}
              className={styles.addTracksButton}
              disabled={!canPerformAction('allowEditPlaylists')}
              title={!canPerformAction('allowEditPlaylists') ? 'Editing playlists is restricted in party mode' : 'Add tracks from library'}
            >
              <Plus className={styles.plusIcon} />
              Add Tracks
            </button>
          </div>

          {playlist.tracks.length === 0 ? (
            <div className={styles.emptyTracks}>
              <Music className={styles.emptyIcon} />
              <h3>No tracks yet</h3>
              <p>Add some tracks from your music library to get started</p>
              <button
                onClick={() => router.push('/')}
                className={styles.addTracksButton}
                disabled={!canPerformAction('allowEditPlaylists')}
                title={!canPerformAction('allowEditPlaylists') ? 'Editing playlists is restricted in party mode' : 'Add tracks from library'}
              >
                <Plus className={styles.plusIcon} />
                Add Tracks
              </button>
            </div>
          ) : (
            <div className={styles.tracksList}>
              {playlist.tracks.map((playlistTrack, _index) => (
                <div
                  key={playlistTrack.id}
                  className={`${styles.trackItem} ${draggedTrack === playlistTrack.id ? styles.dragging : ''}`}
                  draggable={canPerformAction('allowEditPlaylists')}
                  onDragStart={(e) => handleDragStart(e, playlistTrack.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => { void handleDrop(e, playlistTrack.id) }}
                >
                  <div className={styles.trackDragHandle}>
                    <GripVertical className={styles.dragIcon} />
                  </div>
                  <div className={styles.trackInfo}>
                    <div className={styles.trackTitle}>{playlistTrack.track.title}</div>
                    <div className={styles.trackArtist}>{playlistTrack.track.artist}</div>
                    <div className={styles.trackAlbum}>{playlistTrack.track.album}</div>
                  </div>
                  <div className={styles.trackActions}>
                    <button
                      onClick={() => { void handleRemoveTrack(playlistTrack.id) }}
                      className={styles.removeButton}
                      disabled={!canPerformAction('allowEditPlaylists')}
                      title={!canPerformAction('allowEditPlaylists') ? 'Editing playlists is restricted in party mode' : 'Remove track'}
                    >
                      <Trash2 className={styles.removeIcon} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div 
            className={styles.modalOverlay} 
            onClick={() => setShowDeleteModal(false)}
            onKeyDown={e => { if (e.key === 'Escape') setShowDeleteModal(false) }}
            tabIndex={0}
            role="button"
          >
            <div 
              className={styles.modal} 
              onClick={(e) => e.stopPropagation()}
              onKeyDown={e => { if (e.key === 'Escape') setShowDeleteModal(false) }}
              tabIndex={0}
              role="button"
            >
              <h2>Delete Playlist</h2>
              <p>Are you sure you want to delete &quot;{playlist.name}&quot;? This action cannot be undone.</p>
              <div className={styles.modalActions}>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className={styles.cancelButton}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={() => { void handleDeletePlaylist() }}
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
  )
} 