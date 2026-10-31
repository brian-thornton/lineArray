'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Play, ListMusic, Check } from 'lucide-react'
import { Playlist } from '@/types/music'
import { useSettings } from '@/contexts/SettingsContext'
import { useToast } from '@/contexts/ToastContext'
import { usePlayAll } from '@/hooks/usePlayAll'
import PlaylistCover from '@/components/PlaylistCover/PlaylistCover'
import styles from './page.module.css'

function updatedLabel(dateString: string): string {
  const days = Math.floor((Date.now() - new Date(dateString).getTime()) / 86_400_000)
  if (days <= 0) return 'Updated today'
  if (days === 1) return 'Updated yesterday'
  if (days < 7) return `Updated ${days} days ago`
  return `Updated ${new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

export default function PlaylistsPage(): JSX.Element {
  const router = useRouter()
  const { canPerformAction } = useSettings()
  const { showToast } = useToast()
  const playAll = usePlayAll()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [startingId, setStartingId] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const response = await fetch('/api/playlists')
        if (response.ok) setPlaylists(await response.json() as Playlist[])
      } catch (error) {
        console.error('Error loading playlists:', error)
        showToast('Could not load playlists', 'error')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [showToast])

  useEffect(() => {
    if (showCreateModal) nameInputRef.current?.focus()
  }, [showCreateModal])

  const canCreate = canPerformAction('allowCreatePlaylists')
  const canQueue = canPerformAction('allowAddToQueue')

  const openCreate = (): void => {
    setNewPlaylistName('')
    setNewPlaylistDescription('')
    setShowCreateModal(true)
  }

  // A new playlist is empty, so go straight to it; its empty state explains how to add songs
  const handleCreatePlaylist = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!newPlaylistName.trim() || !canCreate) return
    setIsCreating(true)
    try {
      const response = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlaylistName.trim(), description: newPlaylistDescription.trim() })
      })
      if (response.ok) {
        const created = await response.json() as Playlist
        void router.push(`/playlists/${created.id}`)
      } else {
        const data = await response.json().catch(() => ({})) as { error?: string }
        showToast(data.error ?? 'Could not create playlist', 'error')
        setIsCreating(false)
      }
    } catch (error) {
      console.error('Error creating playlist:', error)
      showToast('Could not create playlist', 'error')
      setIsCreating(false)
    }
  }

  const handlePlay = async (playlist: Playlist): Promise<void> => {
    if (!canQueue || playlist.tracks.length === 0) return
    setStartingId(playlist.id)
    try {
      await playAll(playlist.tracks.map(pt => pt.track.path), playlist.name)
    } catch (error) {
      console.error('Error playing playlist:', error)
      showToast('Could not play playlist', 'error')
    } finally {
      setStartingId(null)
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <p>Loading playlists…</p>
      </div>
    )
  }

  const sorted = [...playlists].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>
          <ListMusic className={styles.titleIcon} />
          Playlists
          {playlists.length > 0 && <span className={styles.count}>{playlists.length}</span>}
        </h1>
        {playlists.length > 0 && (
          <button
            onClick={openCreate}
            className={styles.createButton}
            disabled={!canCreate}
            title={!canCreate ? 'Creating playlists is restricted in party mode' : 'Create a new playlist'}
          >
            <Plus className={styles.buttonIcon} />
            New playlist
          </button>
        )}
      </div>

      {playlists.length === 0 ? (
        <div className={styles.empty}>
          <ListMusic className={styles.emptyIcon} />
          <h2>No playlists yet</h2>
          <p>Make one for the party, then fill it from any album with <strong>Add to Playlist</strong>.</p>
          <button
            onClick={openCreate}
            className={styles.createButton}
            disabled={!canCreate}
            title={!canCreate ? 'Creating playlists is restricted in party mode' : 'Create your first playlist'}
          >
            <Plus className={styles.buttonIcon} />
            Create a playlist
          </button>
        </div>
      ) : (
        <ul className={styles.grid}>
          {sorted.map(playlist => {
            const count = playlist.tracks.length
            const playDisabled = count === 0 || !canQueue
            return (
              <li key={playlist.id} className={styles.tile}>
                <button
                  className={styles.tileMain}
                  onClick={() => router.push(`/playlists/${playlist.id}`)}
                  aria-label={`Open ${playlist.name}`}
                >
                  <PlaylistCover tracks={playlist.tracks} className={styles.tileCover} />
                  <span className={styles.tileText}>
                    <span className={styles.tileName}>{playlist.name}</span>
                    <span className={styles.tileMeta}>
                      {count === 0 ? 'Empty' : `${count} ${count === 1 ? 'track' : 'tracks'}`} · {updatedLabel(playlist.updatedAt)}
                    </span>
                  </span>
                </button>
                {count > 0 && (
                  <button
                    className={`${styles.playFab} ${startingId === playlist.id ? styles.playFabBusy : ''}`}
                    onClick={() => { void handlePlay(playlist) }}
                    disabled={playDisabled || startingId === playlist.id}
                    title={!canQueue ? 'Adding to queue is restricted in party mode' : `Play ${playlist.name}`}
                    aria-label={`Play ${playlist.name}`}
                  >
                    <Play className={styles.playFabIcon} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {showCreateModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowCreateModal(false)}
          onKeyDown={e => { if (e.key === 'Escape') setShowCreateModal(false) }}
          role="presentation"
        >
          <form
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-modal-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Escape') setShowCreateModal(false) }}
            onSubmit={e => { void handleCreatePlaylist(e) }}
          >
            <h2 id="create-modal-title">New playlist</h2>
            <label className={styles.fieldLabel}>
              Name
              <input
                ref={nameInputRef}
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Friday night"
                className={styles.input}
                enterKeyHint="done"
                required
              />
            </label>
            <label className={styles.fieldLabel}>
              Description
              <textarea
                value={newPlaylistDescription}
                onChange={(e) => setNewPlaylistDescription(e.target.value)}
                placeholder="Optional"
                className={styles.input}
                rows={2}
              />
            </label>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setShowCreateModal(false)} className={styles.secondaryButton} disabled={isCreating}>
                Cancel
              </button>
              <button type="submit" className={styles.saveButton} disabled={isCreating || !newPlaylistName.trim()}>
                <Check className={styles.buttonIcon} />
                {isCreating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
