'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Play, Edit, Save, X, Trash2, Plus, Music, GripVertical } from 'lucide-react'
import { Playlist, PlaylistTrack } from '@/types/music'
import styles from './page.module.css'

export default function PlaylistDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
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
    loadPlaylist()
  }, [params.id])

  const loadPlaylist = async () => {
    try {
      const response = await fetch(`/api/playlists/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setPlaylist(data)
        setEditName(data.name)
        setEditDescription(data.description || '')
      } else {
        console.error('Failed to load playlist')
        router.push('/playlists')
      }
    } catch (error) {
      console.error('Error loading playlist:', error)
      router.push('/playlists')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!playlist) return

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
        const updatedPlaylist = await response.json()
        setPlaylist(updatedPlaylist)
        setIsEditing(false)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update playlist')
      }
    } catch (error) {
      console.error('Error updating playlist:', error)
      alert('Failed to update playlist')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePlaylist = async () => {
    if (!playlist) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/playlists/${playlist.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        router.push('/playlists')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete playlist')
      }
    } catch (error) {
      console.error('Error deleting playlist:', error)
      alert('Failed to delete playlist')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRemoveTrack = async (trackId: string) => {
    if (!playlist) return

    try {
      const response = await fetch(`/api/playlists/${playlist.id}/tracks/${trackId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Reload playlist to get updated data
        await loadPlaylist()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to remove track')
      }
    } catch (error) {
      console.error('Error removing track:', error)
      alert('Failed to remove track')
    }
  }

  const handlePlayPlaylist = async () => {
    if (!playlist || playlist.tracks.length === 0) {
      alert('This playlist is empty')
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
      router.push('/')
    } catch (error) {
      console.error('Error playing playlist:', error)
      alert('Failed to play playlist')
    }
  }

  const handleDragStart = (e: React.DragEvent, trackId: string) => {
    setDraggedTrack(trackId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, dropTrackId: string) => {
    e.preventDefault()
    if (!playlist || !draggedTrack || draggedTrack === dropTrackId) return

    try {
      // Get current track order
      const trackIds = playlist.tracks.map(pt => pt.id)
      
      // Remove dragged track from its current position
      const draggedIndex = trackIds.indexOf(draggedTrack)
      trackIds.splice(draggedIndex, 1)
      
      // Insert dragged track at drop position
      const dropIndex = trackIds.indexOf(dropTrackId)
      trackIds.splice(dropIndex, 0, draggedTrack)

      // Send reorder request
      const response = await fetch(`/api/playlists/${playlist.id}/tracks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackIds })
      })

      if (response.ok) {
        // Reload playlist to get updated data
        await loadPlaylist()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to reorder tracks')
      }
    } catch (error) {
      console.error('Error reordering tracks:', error)
      alert('Failed to reorder tracks')
    } finally {
      setDraggedTrack(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading playlist...</p>
      </div>
    )
  }

  if (!playlist) {
    return (
      <div className={styles.errorContainer}>
        <p>Playlist not found</p>
        <button onClick={() => router.push('/playlists')} className={styles.backButton}>
          Back to Playlists
        </button>
      </div>
    )
  }

  return (
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
                {playlist.description && (
                  <p className={styles.playlistDescription}>{playlist.description}</p>
                )}
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
                onClick={handleSaveEdit}
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
                  setEditDescription(playlist.description || '')
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
                onClick={handlePlayPlaylist}
                className={styles.playButton}
                disabled={playlist.trackCount === 0}
                title={playlist.trackCount === 0 ? 'Playlist is empty' : 'Play playlist'}
              >
                <Play className={styles.playIcon} />
                Play Playlist
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className={styles.editButton}
                title="Edit playlist"
              >
                <Edit className={styles.editIcon} />
                Edit
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className={styles.deleteButton}
                title="Delete playlist"
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
            onClick={() => router.push(`/playlists/${playlist.id}/add-tracks`)}
            className={styles.addTracksButton}
          >
            <Plus className={styles.plusIcon} />
            Add Tracks
          </button>
        </div>

        {playlist.tracks.length === 0 ? (
          <div className={styles.emptyTracks}>
            <Music className={styles.emptyIcon} />
            <h3>No tracks in this playlist</h3>
            <p>Add some tracks to get started</p>
            <button
              onClick={() => router.push(`/playlists/${playlist.id}/add-tracks`)}
              className={styles.addFirstTracksButton}
            >
              <Plus className={styles.plusIcon} />
              Add Tracks
            </button>
          </div>
        ) : (
          <div className={styles.trackList}>
            {playlist.tracks.map((playlistTrack, index) => (
              <div
                key={playlistTrack.id}
                className={`${styles.trackItem} ${draggedTrack === playlistTrack.id ? styles.dragging : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, playlistTrack.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, playlistTrack.id)}
              >
                <div className={styles.dragHandle}>
                  <GripVertical className={styles.gripIcon} />
                </div>
                
                <div className={styles.trackInfo}>
                  <span className={styles.trackNumber}>
                    {playlistTrack.position + 1}
                  </span>
                  <div className={styles.trackDetails}>
                    <span className={styles.trackTitle}>{playlistTrack.track.title}</span>
                    <span className={styles.trackAlbum}>{playlistTrack.track.album}</span>
                  </div>
                </div>

                <div className={styles.trackActions}>
                  <button
                    onClick={() => handleRemoveTrack(playlistTrack.id)}
                    className={styles.removeTrackButton}
                    title="Remove from playlist"
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
        <div className={styles.modalOverlay} onClick={() => setShowDeleteModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Delete Playlist</h2>
            <p>Are you sure you want to delete "{playlist.name}"? This action cannot be undone.</p>
            <div className={styles.modalActions}>
              <button
                onClick={() => setShowDeleteModal(false)}
                className={styles.cancelButton}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePlaylist}
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