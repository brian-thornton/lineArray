// VLC connection settings for server ("Jukebox") playback.
//
// By default the app spawns its own VLC on this machine. In Docker, or when VLC
// runs somewhere else (the host, a sidecar container), set VLC_HOST and the app
// will only talk to that instance over HTTP — it never spawns or kills it.
//
//   VLC_HOST      default "localhost"
//   VLC_PORT      default 8081
//   VLC_PASSWORD  default "jukebox"
//   VLC_EXTERNAL  "true" to never spawn VLC even when VLC_HOST is local
//   VLC_DISABLED  "true" to turn server playback off entirely (browser-only)

const host = process.env.VLC_HOST ?? 'localhost'
const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1'

export const VLC_PORT = parseInt(process.env.VLC_PORT ?? '8081', 10)
export const VLC_PASSWORD = process.env.VLC_PASSWORD ?? 'jukebox'
export const VLC_BASE_URL = `http://${host.includes(':') ? `[${host}]` : host}:${VLC_PORT}`
export const VLC_DISABLED = process.env.VLC_DISABLED === 'true'
export const VLC_MANAGED = !VLC_DISABLED && isLocalHost && process.env.VLC_EXTERNAL !== 'true'

export function vlcAuthHeaders(): Record<string, string> {
  return { Authorization: `Basic ${Buffer.from(`:${VLC_PASSWORD}`).toString('base64')}` }
}
