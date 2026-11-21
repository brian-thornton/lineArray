// Runs once when the Next.js server starts. Loads the music library and checks which
// albums are on disk in the background, so the first library page after a (Docker)
// restart is served from memory instead of waiting on tens of thousands of file checks.
//
// The import must stay inside this exact NEXT_RUNTIME check: it is how Next.js leaves the
// Node-only library code out of the edge build of this file.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { warmLibrary } = await import('./utils/libraryStore')
    void warmLibrary()
  }
}
