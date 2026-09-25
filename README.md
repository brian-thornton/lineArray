# Jukebox 2.0

A modern, touch-friendly jukebox application built with Next.js and TypeScript. Inspired by TouchTunes — designed for a living room, bar, or party context where the interface needs to look great and work well on any device from phone to desktop.

Music can play in two ways, chosen per device from the player bar:

- **This device** (default) — audio streams to the browser and plays on the phone/laptop/tablet you're using. Each device has its own queue.
- **Jukebox** — the shared queue plays through VLC on the machine hosting the app (e.g. a box connected to the room's speakers). The app controls VLC over its HTTP interface.

---

## Features

- **Album library** — Recursively scans a local music directory and organizes tracks by album (folder)
- **Letter navigation** — Jump to any letter in the library; iOS-style index bar on mobile
- **Two playback modes** — stream to the browser, or play through the host's speakers via VLC
- **Queue management** — Add individual tracks or full albums, reorder the queue
- **Playlists** — Create, edit, and play saved playlists
- **Search** — Full-text search across albums and tracks
- **Recently played** — Tracks recently played with quick replay
- **Play counts** — Tracks how many times each album has been played
- **Volume control** — Bottom-sheet slider on mobile, inline controls on desktop
- **Cover art** — Automatically finds and serves folder artwork
- **QR code** — Generates a QR code so mobile devices can connect to the same instance
- **Party mode / PIN** — Optional PIN protection to lock settings
- **Admin panel** — Manage library folders and scan paths
- **Themes** — Switchable color themes
- **Responsive** — Optimized for desktop (1024px+), tablet/iPad (768–1024px), and mobile (≤767px)

---

## Architecture

```mermaid
flowchart TD
    subgraph Browser["🌐 Browser"]
        Pages["Pages\nHome · Album · Playlists · Recent · Settings"]
        Components["Components\nPlayer · Queue · AlbumGrid · SearchBox · Header"]
        Contexts["Context Providers\nLibrary · Settings · Search · Toast"]
        Pages <--> Components
        Components <--> Contexts
    end

    subgraph NextAPI["⚙️ Next.js API Routes"]
        direction LR
        ScanAPI["scan\nalbums\ncover\nbrowse"]
        PlayAPI["play\ncontrol\nqueue"]
        DataAPI["playlists\nsearch\nplaycounts\nsettings · themes"]
    end

    subgraph AudioLayer["🔊 Audio"]
        AudioMgr["AudioManager\naudio-manager.ts"]
        VLC["VLC Media Player\nHTTP interface · port 8081"]
        AudioMgr -- "HTTP commands\n(play, pause, seek, volume)" --> VLC
    end

    subgraph Storage["💾 File System"]
        MusicFiles["Music Files\nMP3 · FLAC · M4A · WAV · OGG"]
        CoverArt["Cover Art\nJPG · PNG · GIF"]
        JSONData["JSON Data\nmusic-library · queue-state\nplaylists · settings · playCounts"]
    end

    Browser -- "REST / JSON" --> NextAPI
    PlayAPI --> AudioMgr
    ScanAPI --> MusicFiles
    ScanAPI --> CoverArt
    ScanAPI --> JSONData
    DataAPI --> JSONData
    VLC --> MusicFiles
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14, React 18 |
| Language | TypeScript 5 |
| Styling | CSS Modules + custom design system |
| Icons | Lucide React |
| Audio backend | Browser `<audio>` streaming; VLC Media Player (HTTP API) for server playback |
| Transcoding | ffmpeg (formats browsers can't decode, e.g. ALAC, AIFF) |
| Metadata | music-metadata |
| File I/O | fs-extra |
| QR codes | qrcode |

---

## Prerequisites

1. **Node.js** 20+
2. **ffmpeg** (optional) — lets browsers play formats they can't decode natively, such as ALAC `.m4a` and AIFF
3. **VLC Media Player** (optional) — only needed for server ("Jukebox") playback. The app starts VLC itself if `vlc` is on the `PATH`, or connects to one you run separately (see [Configuration](#configuration))

Or skip all of that and use [Docker](#docker).

---

## Installation

```bash
git clone <repository-url>
cd jukebox_2.0
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Configure the music library path in **Settings** on first run.

---

## Docker

```bash
cp .env.example .env        # set MUSIC_PATH, and PUBLIC_HOST for the QR code
docker compose up -d --build
```

Open `http://<host>:3000`. Settings, the library index, playlists and play counts are stored in `./data` on the host.

Your music folder is mounted read-only at the **same path** it has on the host, because the library index stores absolute file paths. If you already have a `data/` folder from running outside Docker, the existing library keeps working without a rescan.

By default the container runs **browser playback only**. This works on any host, including Docker Desktop/OrbStack on macOS, where containers can't reach the Mac's speakers. For server ("Jukebox") playback, pick one option in `docker-compose.yml`:

- **Option A — Linux host with speakers:** VLC runs inside the container. Pass the sound device through (`devices: [/dev/snd:/dev/snd]`) and remove `VLC_DISABLED`.
- **Option B — VLC on the host (any OS):** run `vlc --intf http --http-host 0.0.0.0 --http-port 8081 --http-password jukebox --no-video` on the host and set `VLC_HOST=host.docker.internal`. The host must see the music at the same path as the container.

For a smaller browser-only image, build with `--build-arg INSTALL_VLC=false`.

---

## Configuration

Environment variables (all optional):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `PUBLIC_HOST` | — | `host:port` phones should use; overrides the address in the QR code (needed in Docker) |
| `VLC_HOST` | `localhost` | Where VLC's HTTP interface is. Any non-local host means an external VLC that the app never starts or stops |
| `VLC_PORT` | `8081` | VLC HTTP port |
| `VLC_PASSWORD` | `jukebox` | VLC HTTP password |
| `VLC_EXTERNAL` | `false` | `true` = don't start VLC even though `VLC_HOST` is local |
| `VLC_DISABLED` | `false` | `true` = browser playback only; hides the Jukebox option |

---

## Usage

### Scanning your library

1. Go to **Settings** and set your music directory path
2. Click **Scan Music Library** — the app recursively scans and indexes all audio files
3. Each folder at the deepest level is treated as one album

### Browsing and playing

- Browse albums in the grid; use the letter bar to jump by initial
- Click an album to open its track list
- Click any track to play it, or use **Play Album** to queue the whole album
- The player bar at the bottom controls playback, volume, and shows now-playing info

### Supported formats

- **Audio**: MP3, FLAC, M4A, WAV, OGG, AAC
- **Cover art**: JPG, JPEG, PNG, GIF, BMP

---

## Project Structure

```
jukebox_2.0/
├── app/                         # Next.js app router
│   ├── api/                     # API routes
│   │   ├── albums/              # Library retrieval
│   │   ├── browse/              # File browser
│   │   ├── control/             # Playback control (play/pause/volume/seek)
│   │   ├── cover/               # Album art serving
│   │   ├── play/                # Track playback
│   │   ├── playcounts/          # Play count tracking
│   │   ├── playlists/           # Playlist CRUD
│   │   ├── queue/               # Queue management
│   │   ├── scan/                # Library scanning
│   │   ├── search/              # Search
│   │   ├── settings/            # App settings
│   │   └── themes/              # Theme management
│   ├── album/[id]/              # Album detail page
│   ├── classic-library/         # Classic list layout
│   ├── playlists/               # Playlists page
│   ├── recent/                  # Recently played page
│   ├── settings/                # Settings page
│   └── page.tsx                 # Home / album grid
├── components/
│   ├── AppHeader/               # Navigation header
│   ├── AppShell.tsx             # Root layout shell
│   ├── LargeAlbumCard/          # Album card (grid view)
│   ├── LargeAlbumGrid/          # Album grid + letter nav
│   ├── AlbumCard/               # Compact album card
│   ├── Player/                  # Fixed player bar
│   ├── Queue/                   # Queue panel
│   ├── SearchBox/               # Search input + results
│   ├── SearchResults/           # Search result list
│   ├── RecentlyPlayed/          # Recently played panel
│   ├── PlaylistModal/           # Add-to-playlist modal
│   ├── PinPad/                  # Party mode PIN entry
│   ├── MeterBridge/             # VU meter display
│   ├── Toast/                   # Notification toasts
│   └── ...                      # Supporting components
├── contexts/                    # React context providers
│   ├── LibraryContext.tsx       # Library + letter filter state
│   ├── SettingsContext.tsx      # App settings
│   ├── SearchContext.tsx        # Search state
│   └── ToastContext.tsx         # Toast notifications
├── types/
│   └── music.ts                 # Shared TypeScript types
├── audio-manager.ts             # VLC HTTP API wrapper
└── data/                        # Runtime data (auto-created)
    ├── music-library.json
    ├── settings.json
    ├── playlists.json
    ├── queue-state.json
    └── playCounts.json
```

---

## Available Scripts

```bash
npm run dev      # Development server (localhost:3000)
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

---

## Design System

Custom CSS variables defined in `app/globals.css`:

- **Colors**: Dark background, cyan accent (`--jukebox-accent`), gold highlights (`--jukebox-gold`)
- **Typography**: Orbitron for display headings, Inter for body text
- **Spacing scale**: `--spacing-xs` through `--spacing-2xl`
- **Breakpoints**: 480px (small mobile), 768px (tablet), 1024px (desktop), 1100px / 1300px (wide desktop)
