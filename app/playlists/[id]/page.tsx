'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Play, Shuffle, Pencil, Trash2, Plus, Music, ListMusic,
  GripVertical, ChevronUp, ChevronDown, X, Check,
} from 'lucide-react'
import { Playlist, PlaylistTrack } from '@/types/music'
import { useSettings } from '@/contexts/SettingsContext'
import { useToast } from '@/contexts/ToastContext'
import { usePlayNow } from '@/hooks/usePlayNow'
import { usePlayAll, shuffled } from '@/hooks/usePlayAll'
import PlaylistCover from '@/components/PlaylistCover/PlaylistCover'
import styles from './page.module.css'

const coverUrl = (coverPath?: string): string | null =>
  coverPath ? `/api/cover/${encodeURIComponent(coverPath)}` : null

function formatDuration(totalSeconds: number): string | null {
  if (totalSeconds <= 0) return null
  const minutes = Math.round(totalSeconds / 60)
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`
}

function Thumb({ coverPath }: { coverPath?: string }): JSX.Element {
  const [failed, setFailed] = useState(false)
  const url = coverUrl(coverPath)
  return (
    <span className={styles.thumb}>
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className={styles.thumbImg} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <Music className={styles.thumbIcon} />
      )}
    </span>
  )
}

export default function PlaylistDetailPage({ params }: { params: { id: string } }): JSX.Element {
  const router = useRouter()
  const { canPerformAction } = useSettings()
  const playNow = usePlayNow()
  const playAll = usePlayAll()
  const { showToast } = useToast()
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRenaming, setIsRenaming] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isEditingTracks, setIsEditingTracks] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [flashingId, setFlashingId] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const loadPlaylist = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`/api/playlists/${params.id}`)
      if (response.ok) {
        setPlaylist(await response.json() as Playlist)
      } else {
        void router.push('/playlists')
      }
    } catch (error) {
      console.error('Error loading playlist:', error)
      void router.push('/playlists')
    } finally {
      setLoading(false)
    }
  }, [params.id, router])

  useEffect(() => {
    void loadPlaylist()
  }, [loadPlaylist])

  useEffect(() => {
    if (isRenaming) nameInputRef.current?.focus()
  }, [isRenaming])

  const canEdit = canPerformAction('allowEditPlaylists')
  const canDelete = canPerformAction('allowDeletePlaylists')
  const canQueue = canPerformAction('allowAddToQueue')
  const editBlockedTitle = 'Editing playlists is restricted in party mode'
  const queueBlockedTitle = 'Adding to queue is restricted in party mode'

  const triggerPlayerRefresh = (): void => {
    const w = window as Window & { hasAddedTrackToQueue?: boolean; checkPlayerStatusImmediately?: () => Promise<void> }
    w.hasAddedTrackToQueue = true
    setTimeout(() => { void w.checkPlayerStatusImmediately?.() }, 100)
  }

  const handlePlayAll = async (shuffle: boolean): Promise<void> => {
    if (!canQueue || !playlist || playlist.tracks.length === 0) return
    const paths = playlist.tracks.map(pt => pt.track.path)
    try {
      await playAll(shuffle ? shuffled(paths) : paths, playlist.name)
    } catch (error) {
      console.error('Error playing playlist:', error)
      showToast('Could not play playlist', 'error')
    }
  }

  const handlePlayTrack = async (pt: PlaylistTrack): Promise<void> => {
    if (!canQueue) return
    const ok = await playNow({ path: pt.track.path, title: pt.displayTitle ?? pt.track.title })
    if (ok) {
      setFlashingId(pt.id)
      setTimeout(() => setFlashingId(null), 600)
      triggerPlayerRefresh()
    }
  }

  const startRename = (): void => {
    if (!playlist) return
    setEditName(playlist.name)
    setEditDescription(playlist.description ?? '')
    setIsRenaming(true)
  }

  const handleSaveDetails = async (): Promise<void> => {
    if (!playlist || !canEdit) return
    setIsSaving(true)
    try {
      const response = await fetch(`/api/playlists/${playlist.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() })
      })
      if (response.ok) {
        const updated = await response.json() as Playlist
        // PUT returns the stored playlist without album info; keep the tracks we already have
        setPlaylist(prev => prev ? { ...prev, name: updated.name, description: updated.description, updatedAt: updated.updatedAt } : updated)
        setIsRenaming(false)
      } else {
        const data = await response.json().catch(() => ({})) as { error?: string }
        showToast(data.error ?? 'Could not save playlist', 'error')
      }
    } catch (error) {
      console.error('Error updating playlist:', error)
      showToast('Could not save playlist', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePlaylist = async (): Promise<void> => {
    if (!playlist || !canDelete) return
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/playlists/${playlist.id}`, { method: 'DELETE' })
      if (response.ok) {
        showToast(`Deleted "${playlist.name}"`, 'success')
        void router.push('/playlists')
      } else {
        showToast('Could not delete playlist', 'error')
      }
    } catch (error) {
      console.error('Error deleting playlist:', error)
      showToast('Could not delete playlist', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  // Track edits update the screen straight away and reload only if the server disagrees
  const handleRemoveTrack = async (pt: PlaylistTrack): Promise<void> => {
    if (!playlist || !canEdit) return
    setPlaylist({
      ...playlist,
      tracks: playlist.tracks.filter(t => t.id !== pt.id),
      trackCount: playlist.trackCount - 1
    })
    try {
      const response = await fetch(`/api/playlists/${playlist.id}/tracks/${pt.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
    } catch (error) {
      console.error('Error removing track:', error)
      showToast('Could not remove track', 'error')
      void loadPlaylist()
    }
  }

  const moveTrack = async (from: number, to: number): Promise<void> => {
    if (!playlist || !canEdit || from === to || to < 0 || to >= playlist.tracks.length) return
    const tracks = [...playlist.tracks]
    const [moved] = tracks.splice(from, 1)
    tracks.splice(to, 0, moved)
    setPlaylist({ ...playlist, tracks })
    try {
      const response = await fetch(`/api/playlists/${playlist.id}/tracks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackIds: tracks.map(t => t.id) })
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
    } catch (error) {
      console.error('Error reordering tracks:', error)
      showToast('Could not reorder tracks', 'error')
      void loadPlaylist()
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <p>Loading playlist…</p>
      </div>
    )
  }

  if (!playlist) {
    return (
      <div className={styles.loadingContainer}>
        <h2>Playlist not found</h2>
        <button onClick={() => router.push('/playlists')} className={styles.secondaryButton}>
          <ArrowLeft className={styles.buttonIcon} />
          Back to Playlists
        </button>
      </div>
    )
  }

  const totalDuration = formatDuration(playlist.tracks.reduce((sum, pt) => sum + (pt.track.duration ?? 0), 0))
  const count = playlist.tracks.length
  const isEmpty = count === 0
  const editing = isEditingTracks && canEdit && !isEmpty

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        <aside className={styles.panel}>
          <div className={styles.panelTop}>
            <button onClick={() => router.push('/playlists')} className={styles.backLink}>
              <ArrowLeft className={styles.backLinkIcon} />
              Playlists
            </button>
            <div className={styles.manage}>
              <button
                onClick={startRename}
                className={styles.manageButton}
                disabled={!canEdit}
                title={!canEdit ? editBlockedTitle : 'Rename playlist'}
                aria-label="Rename playlist"
              >
                <Pencil className={styles.manageIcon} />
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className={`${styles.manageButton} ${styles.danger}`}
                disabled={!canDelete}
                title={!canDelete ? 'Deleting playlists is restricted in party mode' : 'Delete playlist'}
                aria-label="Delete playlist"
              >
                <Trash2 className={styles.manageIcon} />
              </button>
            </div>
          </div>

          <PlaylistCover tracks={playlist.tracks} className={styles.cover} />

          <div className={styles.info}>
            <span className={styles.eyebrow}>Playlist</span>
            <h1 className={styles.title}>{playlist.name}</h1>
            {playlist.description && <p className={styles.description}>{playlist.description}</p>}
            <p className={styles.metaLine}>
              {[`${count} ${count === 1 ? 'track' : 'tracks'}`, totalDuration].filter(Boolean).join(' · ')}
            </p>
          </div>

          <div className={styles.actions}>
            <button
              onClick={() => { void handlePlayAll(false) }}
              className={styles.playButton}
              disabled={isEmpty || !canQueue}
              title={!canQueue ? queueBlockedTitle : isEmpty ? 'Playlist is empty' : 'Play playlist'}
            >
              <Play className={styles.buttonIcon} />
              Play
            </button>
            <button
              onClick={() => { void handlePlayAll(true) }}
              className={styles.shuffleButton}
              disabled={isEmpty || !canQueue}
              title={!canQueue ? queueBlockedTitle : isEmpty ? 'Playlist is empty' : 'Shuffle playlist'}
            >
              <Shuffle className={styles.buttonIcon} />
              Shuffle
            </button>
          </div>
        </aside>

        <section className={`${styles.tracksPanel} ${editing ? styles.tracksEditing : ''}`}>
          <div className={styles.tracksHeader}>
            <h2 className={styles.tracksTitle}>{editing ? 'Edit tracks' : 'Tracks'}</h2>
            <div className={styles.tracksActions}>
              {editing ? (
                <button onClick={() => setIsEditingTracks(false)} className={styles.doneButton}>
                  <Check className={styles.buttonIcon} />
                  Done
                </button>
              ) : (
                <>
                  <button
                    onClick={() => router.push('/')}
                    className={styles.secondaryButton}
                    disabled={!canEdit}
                    title={!canEdit ? editBlockedTitle : 'Pick albums in the library and use Add to Playlist'}
                  >
                    <Plus className={styles.buttonIcon} />
                    Add songs
                  </button>
                  {!isEmpty && (
                    <button
                      onClick={() => setIsEditingTracks(true)}
                      className={styles.secondaryButton}
                      disabled={!canEdit}
                      title={!canEdit ? editBlockedTitle : 'Reorder or remove tracks'}
                    >
                      <Pencil className={styles.buttonIcon} />
                      Edit
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {isEmpty ? (
            <div className={styles.empty}>
              <ListMusic className={styles.emptyIcon} />
              <h3>No tracks yet</h3>
              <p>Open an album in the library, pick tracks, and tap <strong>Add to Playlist</strong>.</p>
            </div>
          ) : (
            <ol
              className={styles.trackList}
              style={{ '--track-rows': Math.ceil(count / 2) } as React.CSSProperties}
            >
              {playlist.tracks.map((pt, index) => {
                const subtitle = [
                  pt.track.artist && pt.track.artist !== 'Unknown Artist' ? pt.track.artist : null,
                  pt.albumTitle ?? pt.track.album
                ].filter(Boolean).join(' · ')
                const text = (
                  <>
                    <span className={styles.trackNumber}>{index + 1}</span>
                    <Thumb coverPath={pt.coverPath} />
                    <span className={styles.trackText}>
                      <span className={styles.trackTitle}>{pt.displayTitle ?? pt.track.title}</span>
                      <span className={styles.trackSubtitle}>{subtitle}</span>
                    </span>
                  </>
                )

                if (!editing) {
                  return (
                    <li key={pt.id} className={styles.trackItem}>
                      <button
                        className={`${styles.trackRow} ${flashingId === pt.id ? styles.flash : ''}`}
                        onClick={() => { void handlePlayTrack(pt) }}
                        disabled={!canQueue}
                        title={!canQueue ? queueBlockedTitle : undefined}
                        aria-label={`Play ${pt.track.title}`}
                      >
                        {text}
                        <span className={styles.playIcon}><Play className={styles.playGlyph} /></span>
                      </button>
                    </li>
                  )
                }

                return (
                  <li
                    key={pt.id}
                    className={`${styles.trackItem} ${styles.editRow} ${dragIndex === index ? styles.dragging : ''}`}
                    draggable
                    onDragStart={(e) => { setDragIndex(index); e.dataTransfer.effectAllowed = 'move' }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (dragIndex !== null) void moveTrack(dragIndex, index)
                      setDragIndex(null)
                    }}
                    onDragEnd={() => setDragIndex(null)}
                  >
                    <GripVertical className={styles.grip} aria-hidden="true" />
                    {text}
                    <span className={styles.editControls}>
                      <button
                        className={styles.iconButton}
                        onClick={() => { void moveTrack(index, index - 1) }}
                        disabled={index === 0}
                        aria-label={`Move ${pt.track.title} up`}
                      >
                        <ChevronUp className={styles.iconGlyph} />
                      </button>
                      <button
                        className={styles.iconButton}
                        onClick={() => { void moveTrack(index, index + 1) }}
                        disabled={index === count - 1}
                        aria-label={`Move ${pt.track.title} down`}
                      >
                        <ChevronDown className={styles.iconGlyph} />
                      </button>
                      <button
                        className={`${styles.iconButton} ${styles.removeButton}`}
                        onClick={() => { void handleRemoveTrack(pt) }}
                        aria-label={`Remove ${pt.track.title}`}
                      >
                        <X className={styles.iconGlyph} />
                      </button>
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>

      {isRenaming && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsRenaming(false)}
          onKeyDown={e => { if (e.key === 'Escape') setIsRenaming(false) }}
          role="presentation"
        >
          <form
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-modal-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Escape') setIsRenaming(false) }}
            onSubmit={(e) => { e.preventDefault(); void handleSaveDetails() }}
          >
            <h2 id="rename-modal-title">Edit playlist</h2>
            <label className={styles.fieldLabel}>
              Name
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={styles.input}
                enterKeyHint="done"
                ref={nameInputRef}
              />
            </label>
            <label className={styles.fieldLabel}>
              Description
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className={styles.input}
                placeholder="Optional"
                rows={2}
              />
            </label>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setIsRenaming(false)} className={styles.secondaryButton} disabled={isSaving}>
                Cancel
              </button>
              <button type="submit" className={styles.saveButton} disabled={isSaving || !editName.trim()}>
                <Check className={styles.buttonIcon} />
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showDeleteModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowDeleteModal(false)}
          onKeyDown={e => { if (e.key === 'Escape') setShowDeleteModal(false) }}
          role="presentation"
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Escape') setShowDeleteModal(false) }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <h2 id="delete-modal-title">Delete &quot;{playlist.name}&quot;?</h2>
            <p>The playlist is removed for everyone. The songs stay in your library.</p>
            <div className={styles.modalActions}>
              <button onClick={() => setShowDeleteModal(false)} className={styles.secondaryButton} disabled={isDeleting}>
                Cancel
              </button>
              <button onClick={() => { void handleDeletePlaylist() }} className={styles.deleteConfirmButton} disabled={isDeleting}>
                <Trash2 className={styles.buttonIcon} />
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
