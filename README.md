# Jukebox 2.0 🎵

A modern, responsive jukebox application built with React and Next.js, designed to manage and play your local music collection. Inspired by TouchTunes, this application provides a beautiful, touch-friendly interface for browsing and playing your music.

## Features

- **🎵 Music Library Scanning**: Recursively scan your local music directories
- **📱 Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **👆 Touch-Friendly Interface**: Large buttons and intuitive controls for touch devices
- **🎨 Modern UI**: Beautiful dark theme with neon accents and smooth animations
- **📊 Album Organization**: Automatically organizes music by albums (folders)
- **🎧 Audio Player**: Full-featured player with progress, volume, and playback controls
- **💾 Local Storage**: Saves your music library index and settings locally
- **🔍 Metadata Extraction**: Reads music file metadata for accurate track information
- **🖼️ Cover Art Support**: Automatically finds and displays album artwork

## Technology Stack

- **Frontend**: React 18, Next.js 14, TypeScript
- **Styling**: CSS Modules with custom design system
- **Icons**: Lucide React
- **Audio**: HTML5 Audio API
- **File Processing**: fs-extra, music-metadata
- **Animations**: CSS animations and Framer Motion

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd jukebox_2.0
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Scanning Your Music Library

1. Click the "Scan Music Library" button
2. Enter the path to your music directory (e.g., `/Users/username/Music` or `C:\Users\username\Music`)
3. The application will recursively scan the directory and organize music by albums
4. Each folder at the lowest level is treated as an album

### Playing Music

1. Browse your albums in the grid view
2. Click the expand button (+) on an album to see its tracks
3. Click the play button on any track to start playback
4. Use the player controls at the bottom to control playback

### Supported File Formats

- **Audio**: MP3, FLAC, M4A, WAV, OGG, AAC
- **Cover Art**: JPG, JPEG, PNG, GIF, BMP

## Project Structure

```
jukebox_2.0/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── scan/          # Music scanning endpoint
│   │   └── albums/        # Library retrieval endpoint
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main page
├── components/            # React components
│   ├── AlbumCard/         # Individual album display
│   ├── AlbumGrid/         # Album grid layout
│   ├── JukeboxHeader/     # Application header
│   ├── Player/            # Audio player
│   └── ScanButton/        # Library scanning controls
├── types/                 # TypeScript type definitions
│   └── music.ts           # Music-related types
├── data/                  # Local data storage (auto-created)
│   ├── music-library.json # Scanned music library
│   └── settings.json      # Application settings
└── package.json           # Dependencies and scripts
```

## Design System

The application uses a custom CSS design system with:

- **Color Palette**: Dark theme with neon accents (gold, red, blue, purple)
- **Typography**: Orbitron for display text, Inter for body text
- **Spacing**: Consistent spacing scale (xs, sm, md, lg, xl, 2xl)
- **Animations**: Smooth transitions, hover effects, and loading animations
- **Responsive Breakpoints**: Mobile-first design with tablet and desktop optimizations

## API Endpoints

### POST /api/scan
Scans a directory for music files and builds the album index.

**Request Body:**
```json
{
  "path": "/path/to/music/directory"
}
```

**Response:**
```json
{
  "albums": [...],
  "totalTracks": 1234,
  "scanPath": "/path/to/music/directory",
  "scanDate": "2024-01-01T00:00:00.000Z"
}
```

### GET /api/albums
Retrieves the saved music library data.

**Response:**
```json
{
  "albums": [...],
  "scanPath": "/path/to/music/directory"
}
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Adding New Features

1. Create new components in the `components/` directory
2. Add TypeScript types in `types/` directory
3. Create API routes in `app/api/` directory
4. Use CSS modules for component styling

## Browser Support

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

## License

This project is open source and available under the [MIT License](LICENSE).

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

If you encounter any issues or have questions, please open an issue on the GitHub repository. 