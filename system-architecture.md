# Jukebox 2.0 System Architecture

```mermaid
graph TB
    %% User Interface Layer
    subgraph "Frontend Layer"
        UI[User Interface]
        subgraph "Pages"
            HOME[Home Page]
            SETTINGS[Settings Page]
            PLAYLISTS[Playlists Page]
            RECENT[Recent Page]
            ALBUM[Album Detail Page]
        end
        
        subgraph "Core Components"
            APP_SHELL[AppShell]
            HEADER[AppHeader]
            PLAYER[Player Component]
            QUEUE[Queue Component]
            ALBUM_GRID[AlbumGrid]
            ALBUM_CARD[AlbumCard]
            SEARCH[SearchBox]
        end
        
        subgraph "UI Components"
            TOAST[Toast]
            MODAL[PlaylistModal]
            PINPAD[PinPad]
            SCAN[ScanButton]
            PAGINATION[Pagination]
            QRCODE[QRCode]
        end
    end
    
    %% Context Layer
    subgraph "Context Layer"
        SETTINGS_CTX[SettingsContext]
        LIBRARY_CTX[LibraryContext]
        SEARCH_CTX[SearchContext]
        THEME_CTX[ThemeContext]
        TOAST_CTX[ToastContext]
    end
    
    %% API Layer
    subgraph "API Layer"
        subgraph "Music Management"
            SCAN_API[/api/scan]
            ALBUMS_API[/api/albums]
            COVER_API[/api/cover]
            BROWSE_API[/api/browse]
        end
        
        subgraph "Playback Control"
            PLAY_API[/api/play]
            CONTROL_API[/api/control]
            QUEUE_API[/api/queue]
            AUDIO_API[/api/audio]
        end
        
        subgraph "Settings & Admin"
            SETTINGS_API[/api/settings]
            ADMIN_API[/api/admin]
            THEMES_API[/api/themes]
            LOGS_API[/api/logs]
        end
        
        subgraph "Playlists & Search"
            PLAYLISTS_API[/api/playlists]
            SEARCH_API[/api/search]
            PLAYCOUNTS_API[/api/playcounts]
        end
    end
    
    %% Audio Management Layer
    subgraph "Audio Management"
        AUDIO_MGR[AudioManager]
        AFPLAY_MGR[AFPlayManager]
        VLC_MGR[VLCManager]
        VOLUME_MGR[VolumeManager]
    end
    
    %% Data Layer
    subgraph "Data Layer"
        subgraph "File System"
            MUSIC_FILES[Music Files<br/>MP3, FLAC, M4A, WAV]
            COVER_ART[Cover Art<br/>JPG, PNG, GIF]
            METADATA[Music Metadata]
        end
        
        subgraph "Local Storage"
            LIBRARY_JSON[music-library.json]
            SETTINGS_JSON[settings.json]
            PLAYLISTS_JSON[playlists.json]
            QUEUE_JSON[queue-state.json]
            PLAYCOUNTS_JSON[playCounts.json]
            THEMES_JSON[themes.json]
        end
    end
    
    %% External Dependencies
    subgraph "External Dependencies"
        VLC[VLC Media Player]
        AFPLAY[macOS AFPLAY]
        FS[File System API]
        MUSIC_METADATA[music-metadata]
    end
    
    %% Connections
    UI --> SETTINGS_CTX
    UI --> LIBRARY_CTX
    UI --> SEARCH_CTX
    UI --> THEME_CTX
    UI --> TOAST_CTX
    
    SETTINGS_CTX --> SETTINGS_API
    LIBRARY_CTX --> ALBUMS_API
    SEARCH_CTX --> SEARCH_API
    
    SCAN_API --> MUSIC_FILES
    SCAN_API --> METADATA
    ALBUMS_API --> LIBRARY_JSON
    COVER_API --> COVER_ART
    
    PLAY_API --> AUDIO_MGR
    CONTROL_API --> AUDIO_MGR
    QUEUE_API --> QUEUE_JSON
    
    AUDIO_MGR --> VLC_MGR
    AUDIO_MGR --> AFPLAY_MGR
    AUDIO_MGR --> VOLUME_MGR
    
    VLC_MGR --> VLC
    AFPLAY_MGR --> AFPLAY
    
    SETTINGS_API --> SETTINGS_JSON
    PLAYLISTS_API --> PLAYLISTS_JSON
    PLAYCOUNTS_API --> PLAYCOUNTS_JSON
    THEMES_API --> THEMES_JSON
    
    %% Styling
    classDef frontend fill:#e1f5fe
    classDef context fill:#f3e5f5
    classDef api fill:#e8f5e8
    classDef audio fill:#fff3e0
    classDef data fill:#fce4ec
    classDef external fill:#f1f8e9
    
    class UI,HOME,SETTINGS,PLAYLISTS,RECENT,ALBUM,APP_SHELL,HEADER,PLAYER,QUEUE,ALBUM_GRID,ALBUM_CARD,SEARCH,TOAST,MODAL,PINPAD,SCAN,PAGINATION,QRCODE frontend
    class SETTINGS_CTX,LIBRARY_CTX,SEARCH_CTX,THEME_CTX,TOAST_CTX context
    class SCAN_API,ALBUMS_API,COVER_API,BROWSE_API,PLAY_API,CONTROL_API,QUEUE_API,AUDIO_API,SETTINGS_API,ADMIN_API,THEMES_API,LOGS_API,PLAYLISTS_API,SEARCH_API,PLAYCOUNTS_API api
    class AUDIO_MGR,AFPLAY_MGR,VLC_MGR,VOLUME_MGR audio
    class MUSIC_FILES,COVER_ART,METADATA,LIBRARY_JSON,SETTINGS_JSON,PLAYLISTS_JSON,QUEUE_JSON,PLAYCOUNTS_JSON,THEMES_JSON data
    class VLC,AFPLAY,FS,MUSIC_METADATA external
```

## Architecture Overview

### Frontend Layer
- **Next.js 14** with React 18 and TypeScript
- **Responsive Design** optimized for desktop, tablet, and mobile
- **Component-based Architecture** with reusable UI components
- **CSS Modules** for scoped styling

### Context Layer
- **State Management** using React Context API
- **Settings Management** for application configuration
- **Library Management** for music collection state
- **Search Management** for search functionality
- **Theme Management** for UI theming
- **Toast Management** for user notifications

### API Layer
- **RESTful API** built with Next.js API routes
- **Music Management** endpoints for scanning and library operations
- **Playback Control** endpoints for audio management
- **Settings & Admin** endpoints for configuration
- **Playlists & Search** endpoints for playlist and search operations

### Audio Management Layer
- **Multi-engine Support** (VLC, AFPLAY)
- **Volume Control** with system integration
- **Audio Processing** with equalizer support
- **Cross-platform** audio handling

### Data Layer
- **File System Integration** for music file access
- **Local JSON Storage** for application data
- **Metadata Extraction** using music-metadata library
- **Cover Art Management** with automatic detection

### External Dependencies
- **VLC Media Player** for advanced audio features
- **macOS AFPLAY** for native audio playback
- **File System API** for file operations
- **music-metadata** for audio file parsing
