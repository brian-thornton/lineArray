'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Clock, Disc3, Flame, Music, Play, SearchX } from 'lucide-react'
import { useSearch } from '@/contexts/SearchContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useToast } from '@/contexts/ToastContext'
import { songKey } from '@/utils/trackTitles'
import type { SearchResult } from '@/types/api'
import styles from './SearchPanel.module.css'

const RECENT_SEARCHES_KEY = 'jukebox-recent-searches'
const MAX_RECENT_SEARCHES = 8
const SUGGESTION_COUNT = 8
const MIN_POPULAR = 3

interface Song {
  path: string
  title: string
  subtitle: string
  coverPath?: string
}

interface SongGroup {
  key: string
  title: string
  versions: Song[]
}

interface PlayCountTrack {
  path: string
  title: string
  album: string
  coverPath?: string
  playCount: number
  lastPlayed: string
}

const coverUrl = (coverPath?: string): string | null =>
  coverPath ? `/api/cover/${encodeURIComponent(coverPath)}` : null

// Recent searches live in this browser only; storage can be unavailable (private mode), so never throw
function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((q): q is string => typeof q === 'string') : []
  } catch {
    return []
  }
}

function saveRecentSearches(list: string[]): void {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list))
  } catch {
    // Storage unavailable; recent searches just won't persist
  }
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

function songCountLabel(songs: number, versions: number): string {
  return songs === versions ? plural(songs, 'song') : `${plural(songs, 'song')} · ${plural(versions, 'version')}`
}

/** How well a song title matches the query: lower is better */
function matchRank(title: string, query: string): number {
  const t = title.toLowerCase()
  if (t.startsWith(query)) return 0
  if (t.split(/\s+/).some(word => word.startsWith(query))) return 1
  if (t.includes(query)) return 2
  return 3 // matched on artist/album only
}

/** Collapse the same song from many shows into one entry */
function groupSongs(results: SearchResult[], query: string): SongGroup[] {
  const groups = new Map<string, SongGroup>()
  for (const r of results) {
    if (r.type !== 'track' || !r.path) continue
    const key = songKey(r.title)
    let group = groups.get(key)
    if (!group) {
      group = { key, title: r.title, versions: [] }
      groups.set(key, group)
    }
    group.versions.push({
      path: r.path,
      title: r.title,
      subtitle: r.albumTitle ?? r.album ?? '',
      coverPath: r.coverPath,
    })
  }
  const q = query.toLowerCase().trim()
  return Array.from(groups.values()).sort((a, b) =>
    matchRank(a.title, q) - matchRank(b.title, q) ||
    b.versions.length - a.versions.length ||
    a.title.localeCompare(b.title)
  )
}

function Thumb({ coverPath, size = 'small' }: { coverPath?: string; size?: 'small' | 'large' }): JSX.Element {
  const [failed, setFailed] = useState(false)
  const url = coverUrl(coverPath)
  return (
    <div className={size === 'large' ? styles.tileCover : styles.thumb}>
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className={styles.thumbImg} onError={() => setFailed(true)} loading="lazy" />
      ) : size === 'large' ? (
        <Disc3 className={styles.tileFallbackIcon} />
      ) : (
        <Music className={styles.thumbFallbackIcon} />
      )}
    </div>
  )
}

interface SongRowProps {
  song: Song
  label?: string
  onPlay: (song: Song) => void
  flashing: boolean
  disabled: boolean
  nested?: boolean
}

function SongRow({ song, label, onPlay, flashing, disabled, nested }: SongRowProps): JSX.Element {
  return (
    <button
      type="button"
      className={`${styles.songRow} ${nested ? styles.nestedRow : ''} ${flashing ? styles.flash : ''}`}
      onClick={() => onPlay(song)}
      disabled={disabled}
      title={disabled ? 'Adding to queue is restricted in party mode' : undefined}
    >
      {!nested && <Thumb coverPath={song.coverPath} />}
      <span className={styles.songText}>
        <span className={styles.songTitle}>{label ?? song.title}</span>
        {!nested && song.subtitle && <span className={styles.songSubtitle}>{song.subtitle}</span>}
      </span>
      <span className={styles.playIcon} aria-hidden="true">
        <Play className={styles.playGlyph} />
      </span>
    </button>
  )
}

export default function SearchPanel(): JSX.Element {
  const { searchQuery, searchResults, isSearching, playTrack, hideKeyboard, searchBoxRef } = useSearch()
  const { canPerformAction } = useSettings()
  const { showToast } = useToast()
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [played, setPlayed] = useState<PlayCountTrack[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [flashingPath, setFlashingPath] = useState<string | null>(null)
  const [showAllRecent, setShowAllRecent] = useState(false)

  const query = searchQuery.trim()
  const canQueue = canPerformAction('allowAddToQueue')

  useEffect(() => {
    setRecentSearches(loadRecentSearches())
    let cancelled = false
    fetch('/api/playcounts')
      .then(res => (res.ok ? res.json() as Promise<{ tracks: PlayCountTrack[] }> : null))
      .then(data => { if (!cancelled && data) setPlayed(data.tracks) })
      .catch(() => { /* suggestions are optional */ })
    return () => { cancelled = true }
  }, [])

  // New query: collapse anything that was expanded
  useEffect(() => { setExpanded(new Set()) }, [query])

  const albums = useMemo(() => searchResults.filter(r => r.type === 'album'), [searchResults])
  const songGroups = useMemo(() => groupSongs(searchResults, query), [searchResults, query])
  const songCount = useMemo(() => songGroups.reduce((n, g) => n + g.versions.length, 0), [songGroups])

  // "Popular" only means something once songs have been played more than once
  const popular = useMemo(
    () => played.filter(t => t.playCount > 1).sort((a, b) => b.playCount - a.playCount).slice(0, SUGGESTION_COUNT),
    [played]
  )
  const showPopular = popular.length >= MIN_POPULAR
  // On its own, Recently played gets the full width (two columns), so show a few more
  const recentLimit = showPopular ? SUGGESTION_COUNT : SUGGESTION_COUNT * 1.5
  const recentlyPlayed = useMemo(
    () => (showAllRecent ? played : played.slice(0, recentLimit)),
    [played, showAllRecent, recentLimit]
  )

  const rememberQuery = (): void => {
    if (!query) return
    const next = [query, ...recentSearches.filter(q => q.toLowerCase() !== query.toLowerCase())].slice(0, MAX_RECENT_SEARCHES)
    setRecentSearches(next)
    saveRecentSearches(next)
  }

  const clearRecentSearches = (): void => {
    setRecentSearches([])
    saveRecentSearches([])
  }

  const handlePlay = async (song: Song): Promise<void> => {
    if (!canQueue) return
    rememberQuery()
    setFlashingPath(song.path)
    setTimeout(() => setFlashingPath(null), 600)
    const outcome = await playTrack(song.path)
    hideKeyboard()
    if (outcome === 'queued') showToast(`Added "${song.title}" to queue`, 'success')
  }

  const toggleGroup = (key: string): void => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toSong = (t: PlayCountTrack): Song => ({ path: t.path, title: t.title, subtitle: t.album, coverPath: t.coverPath })

  // ---------- Before anything is typed ----------
  if (!query) {
    const hasSuggestions = recentSearches.length > 0 || played.length > 0
    return (
      <div className={styles.panel}>
        {recentSearches.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Recent searches</h2>
              <button type="button" className={styles.textButton} onClick={clearRecentSearches}>
                Clear
              </button>
            </div>
            <div className={styles.chips}>
              {recentSearches.map(q => (
                <button key={q} type="button" className={styles.chip} onClick={() => searchBoxRef.current?.setValue(q)}>
                  <Clock className={styles.chipIcon} />
                  {q}
                </button>
              ))}
            </div>
          </section>
        )}

        {played.length > 0 && (
          <div className={`${styles.suggestionColumns} ${showPopular ? '' : styles.singleSuggestion}`}>
            {showPopular && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}><Flame className={styles.sectionIcon} />Popular here</h2>
                </div>
                <div className={styles.list}>
                  {popular.map(t => (
                    <SongRow key={t.path} song={toSong(t)} onPlay={s => { void handlePlay(s) }} flashing={flashingPath === t.path} disabled={!canQueue} />
                  ))}
                </div>
              </section>
            )}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}><Clock className={styles.sectionIcon} />Recently played</h2>
                {played.length > recentLimit && (
                  <button type="button" className={styles.textButton} onClick={() => setShowAllRecent(v => !v)}>
                    {showAllRecent ? 'Show less' : `See all ${played.length}`}
                  </button>
                )}
              </div>
              <div
                className={styles.list}
                style={{ '--list-rows': Math.ceil(recentlyPlayed.length / 2) } as React.CSSProperties}
              >
                {recentlyPlayed.map(t => (
                  <SongRow key={t.path} song={toSong(t)} onPlay={s => { void handlePlay(s) }} flashing={flashingPath === t.path} disabled={!canQueue} />
                ))}
              </div>
            </section>
          </div>
        )}

        {!hasSuggestions && (
          <div className={styles.hint}>
            <Music className={styles.hintIcon} />
            <p>Type an artist, song, venue or date</p>
          </div>
        )}
      </div>
    )
  }

  // ---------- Results ----------
  if (!isSearching && albums.length === 0 && songGroups.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.hint}>
          <SearchX className={styles.hintIcon} />
          <p>No matches for “{query}”</p>
          <span className={styles.hintSub}>Try fewer letters, a venue, or a year</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.panel} ${isSearching ? styles.updating : ''}`}>
      {albums.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Albums <span className={styles.count}>{albums.length}</span></h2>
          </div>
          <div className={styles.albumStrip}>
            {albums.map(a => (
              <Link key={a.id} href={`/album/${a.id}`} className={styles.albumTile} onClick={rememberQuery}>
                <Thumb coverPath={a.coverPath} size="large" />
                <span className={styles.tileTitle}>{a.title}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {songGroups.length > 0 && (
        <section className={`${styles.section} ${styles.songsSection}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              Songs <span className={styles.count}>{songCountLabel(songGroups.length, songCount)}</span>
            </h2>
          </div>
          <div className={styles.songColumns}>
            {songGroups.map(group => {
              const [first] = group.versions
              if (group.versions.length === 1) {
                return (
                  <div key={group.key} className={styles.songItem}>
                    <SongRow song={first} onPlay={s => { void handlePlay(s) }} flashing={flashingPath === first.path} disabled={!canQueue} />
                  </div>
                )
              }
              const isOpen = expanded.has(group.key)
              return (
                <div key={group.key} className={`${styles.songItem} ${styles.group} ${isOpen ? styles.groupOpen : ''}`}>
                  <button
                    type="button"
                    className={styles.groupHeader}
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={isOpen}
                  >
                    <Thumb coverPath={group.versions.find(v => v.coverPath)?.coverPath} />
                    <span className={styles.songText}>
                      <span className={styles.songTitle}>{group.title}</span>
                      <span className={styles.songSubtitle}>{group.versions.length} versions · pick a show</span>
                    </span>
                    <span className={styles.versionBadge}>{group.versions.length}</span>
                    <ChevronDown className={styles.chevron} aria-hidden="true" />
                  </button>
                  {isOpen && (
                    <div className={styles.versions}>
                      {group.versions.map(v => (
                        <SongRow
                          key={v.path}
                          song={v}
                          label={v.subtitle || v.title}
                          onPlay={s => { void handlePlay(s) }}
                          flashing={flashingPath === v.path}
                          disabled={!canQueue}
                          nested
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

