# Jukebox 2.0 — Issues & Improvement Tracker

> Last reviewed: 2026-03-07
> App visited at http://localhost:3000/

---

## Priority Levels
- 🔴 **Critical** — Broken functionality or visible bugs
- 🟠 **High** — Significant UX problems that hurt usability
- 🟡 **Medium** — Noticeable gaps or confusing elements
- 🟢 **Low** — Polish, nice-to-haves, and minor improvements

---

## 🟠 High Priority — UX & Functional Issues

### H1 — Silent failures when Party Mode blocks an action
Multiple places across album detail, queue, and playlists pages use `// TODO: Implement a non-blocking UI alternative` — when a Party Mode restriction blocks an action, nothing happens: no toast, no message, no visual feedback. Users tap buttons that silently do nothing.
**Fix:** Implement a toast notification or inline message (e.g., "Action disabled by Party Mode") at every `canPerformAction` guard.

### H4 — Party Mode has no visible status indicator
Once Party Mode is enabled, there is no persistent banner, badge, or UI indicator that the app is in Party Mode. An admin has no quick way to verify status without going to Settings > Party Mode.
**Fix:** Add a subtle persistent badge or header indicator (e.g., a party icon or colored dot) when Party Mode is active.

### H5 — No PIN brute-force protection
`POST /api/settings/verify-pin` has no rate limiting, no attempt counter, and no lockout. The PIN can be guessed programmatically.
**Fix:** Add server-side rate limiting (e.g., max 5 attempts per minute per IP, with exponential backoff).

### H6 — Track duration is never displayed
The `Track` type has a `duration` field but it is not shown anywhere in the track list, queue panel, or Now Playing overlay. Users have no idea how long a track is.
**Fix:** Display formatted duration (mm:ss) next to each track in album detail track lists, the queue panel, and the Now Playing overlay.

### H7 — No unsaved-changes warning when leaving Settings
If a user changes settings without clicking Save and navigates away, all changes are silently discarded. There is no "unsaved changes" warning.
**Fix:** Track dirty state per settings tab and show a "You have unsaved changes. Leave anyway?" prompt on navigation.

### H8 — Inconsistent settings auto-save behavior
The Theme section saves immediately on click. All other settings require an explicit "Save" button. This inconsistency is confusing.
**Fix:** Either add a Save button for themes (with the same pattern as other sections), or switch all settings to auto-save with a brief "Saved ✓" confirmation.

### H9 — `allowPrevious` party mode setting has no corresponding UI control
There is no "Previous Track" button in the Player UI. The "Allow Previous Track" party mode setting has no effect because the button it would control does not exist.
**Fix:** Either add a Previous Track button to the player, or remove the `allowPrevious` setting from Party Mode to avoid confusion.

### H10 — `allowSkipInQueue` setting is never actually enforced
The player's Skip button checks `canPerformAction('allowNext')`, not `'allowSkipInQueue'`. The "Allow Skip in Queue" Party Mode setting does nothing.
**Fix:** Audit all Party Mode permission keys against the actual `canPerformAction` calls and fix mismatched keys.

---

## 🟡 Medium Priority — Clarity & Design Improvements

### M1 — Admin Settings: Audio Player Engine labels are too technical
The dropdown options "VLC Media Player" and "macOS AFPLAY" are unfamiliar to non-developer users.
**Fix:** Rename options to something like:
- **"Standard (Built-in) — most reliable, no scrubbing"**
- **"Advanced (VLC) — enables seek bar, may be less stable"**
Also: add a note on the "Show Playback Position" toggle that seeking only works with VLC.

### M2 — Admin Settings: Admin PIN does not validate numeric input
The PIN field accepts non-numeric characters (e.g., "abcd"). The error only surfaces at verification time with no live feedback.
**Fix:** Add `pattern="[0-9]*"` and `inputMode="numeric"` to the PIN input, with inline validation that rejects non-digit characters.

### M3 — UI Settings: Missing descriptions on multiple toggles
The following UI settings have no description text explaining what they do:
- **Show Touch Keyboard** — what is a "touch keyboard" in this context?
- **Show Pagination** — what kind of pagination? How do you navigate without it?
- **Show Concert Details** — what is a "concert detail"? (setlist/notes files)
- **Use Mobile Album Layout** — how does this differ from the desktop layout?
- **Use Side-by-Side Album Layout** — what does side-by-side look like? What is the interaction with "Mobile Album Layout"?
- **Show Playback Position** — does not mention that seeking only works with VLC.

**Fix:** Add a one-sentence description below each toggle following the same pattern as the better-documented settings.

### M4 — Admin Settings: Scan console log visible to regular users
The scan section shows a live SSE console log stream during scanning. This is a developer tool and is confusing/noisy for end users.
**Fix:** Hide the console log area behind a "Show Details" disclosure toggle, collapsed by default.

### M5 — Admin Settings: No "Add and Scan" combined action for new folders
After adding a new folder path, users must separately click "Scan All". There is no combined action.
**Fix:** Add an "Add & Scan" button next to the folder path input field as a shortcut.

### M6 — Admin Settings: No path validation before scanning
Any string can be entered as a folder path. Errors only appear after attempting a scan.
**Fix:** Validate the path exists on the server when the user clicks "Add" (before allowing the path to be saved).

### M7 — Settings: Multiple Save buttons with different scopes is confusing
Three separate Save buttons exist across Admin, UI Features, and Party Mode tabs. A user may be unsure which settings are saved by which button.
**Fix:** Consider a unified "Save All Settings" approach, or at minimum make the scope of each button very explicit (e.g., "Save Admin Settings" → "Save Changes to Admin Tab").

### M8 — Letter navigation shows empty results with no feedback
Clicking a letter in the nav bar that has no matching albums shows a completely blank grid with no explanation.
**Fix:** Show an "No albums starting with [letter]" empty state message when the filtered result is empty.

### M9 — "Recently Played" page: misleading description text
The subtext says "in chronological order" but the list is sorted by most-recent-first (reverse chronological).
**Fix:** Change to "sorted by most recently played."

### M10 — Recently Played: only shows 10 tracks with no "load more"
The list is capped at 10 tracks by default with no pagination or "Load more" option.
**Fix:** Add a "Load more" button or infinite scroll to the Recently Played page.

### M11 — Queue panel: track count excludes currently-playing track
The queue panel header says "Queue (N tracks)" but the currently-playing track is not counted. If one track is playing and 5 are queued, it says "Queue (5 tracks)" instead of "6 tracks total."
**Fix:** Show "N in queue" (explicitly about the queue) or include the current track with a note like "Queue (5 tracks + now playing)".

### M12 — Queue panel: drag-and-drop reorder doesn't work on mobile
The HTML5 drag-and-drop reorder in the queue panel requires a mouse and does not work on touch screens.
**Fix:** Implement a touch-friendly reorder (e.g., touch-and-hold to enter reorder mode, or up/down arrow buttons per track on mobile).

### M13 — Now Playing overlay: no queue preview and no volume control
The full-screen Now Playing overlay shows the current track but cannot show the upcoming queue, and has no volume control.
**Fix:** Add a "Up Next" section showing the next 1–3 tracks, and add volume +/- controls to the overlay.

### M14 — Now Playing overlay: progress shown as % only, not mm:ss
Progress is displayed as "73%" instead of "3:42 / 5:05". Since track durations are not shown elsewhere, this is doubly unhelpful.
**Fix:** Display elapsed/total time in mm:ss format once track duration is available in the UI (see H6).

### M15 — Album detail: `AdminAlbumManager` appears at top of page
When Admin Mode is enabled, the `AdminAlbumManager` renders before all other page content, making the admin panel the first thing anyone sees when viewing an album.
**Fix:** Move `AdminAlbumManager` below the album header, or place it in a collapsible section.

### M16 — Album detail: `setlistInfo` section missing from side-by-side layout
Concert Setlist info renders in `default` and `mobile` layouts but is excluded from `sideBySide`. This is inconsistent.
**Fix:** Include the `setlistInfo` section in the side-by-side layout.

### M17 — System logs exposed on unprotected Settings page
The Statistics tab's "System Logs" section shows server-side log data to any user who visits Settings (when Party Mode is off). This is a potential privacy/security concern.
**Fix:** Move System Logs behind Admin Mode authentication, or only show when `enableAdminMode` is true.

### M18 — `/classic-library` route is redundant
The `libraryLayout` setting already renders the "classic" layout on the main `/` route. The `/classic-library` route duplicates this and is not linked from anywhere in the nav.
**Fix:** Remove the `/classic-library` route and its page component, or fully integrate it as a layout option only.

### M19 — "Jukebox Name" setting has no description of where the name appears
Users don't know the name is used in the browser tab title (via `DynamicTitle`) unless they experiment.
**Fix:** Add a description: "This name appears in the browser tab title."

### M20 — The Now Playing overlay auto-show timeout is not configurable
The screensaver-style auto-show after 3 minutes of inactivity is hardcoded.
**Fix:** Expose this as a setting in the UI tab, with options like "Never", "1 min", "3 min", "5 min".

---

## 🟢 Low Priority — Polish & Nice-to-Haves

### L1 — No sort options in the library
Albums always appear in scan order. There is no way to sort by date added, artist name, album name, play count, or year.
**Fix:** Add a "Sort by" dropdown to the library header (alphabetical, date added, most played).

### L2 — Library: total album/track count not visible on main page
Users must go to Settings > Admin to see library statistics.
**Fix:** Show a small "X albums · Y tracks" subtitle in the library header.

### L3 — Player bar: "Ready" state is confusing on first load (mobile)
On mobile, the player bar is always visible even when nothing has played. The "Ready" / "Add tracks to get started" message looks like a stuck loading state.
**Fix:** Consider hiding the mobile player bar until the first track is added, or improve the empty-state copy to be more welcoming (e.g., "Browse the library to start playing music").

### L4 — Volume control: no fine-grained slider on desktop
Volume only changes in 5% increments via +/- buttons on desktop. The mobile bottom sheet has a proper slider.
**Fix:** Add a horizontal volume slider to the desktop player bar.

### L5 — No visual affordance that album cards are clickable
Album cards in the library grid have no hover state or tooltip explaining what happens on click.
**Fix:** Add a subtle hover overlay or cursor change and ensure the card has a descriptive `aria-label`.

### L6 — Empty letter navigation items have no disabled styling
Letter buttons in the nav bar that have no matching albums look identical to those that do. Users have no way to know a letter is empty before clicking it.
**Fix:** Visually dim or disable letter buttons that have no matching albums.

### L7 — Timestamps in Recently Played show no absolute date for old entries
Timestamps show "Xd ago" but never a full date for older entries.
**Fix:** Show the full date (e.g., "Feb 3") for entries older than 7 days, with the relative time in a tooltip.

### L8 — Missing album art preview on playlist cards
Playlist cards show only metadata. No visual preview of the music inside.
**Fix:** Show a 2×2 mosaic of the first 4 album covers in the playlist, as a visual thumbnail.

### L9 — `onKeyPress` is deprecated
`MusicFoldersManager.tsx` uses `onKeyPress`, deprecated since React 17.
**Fix:** Replace with `onKeyDown`.

### L10 — Accessibility: queue modal backdrop uses incorrect ARIA role
The close-backdrop div in the queue panel uses `role="button"` when it should use `role="dialog"` / `aria-modal` patterns.
**Fix:** Implement proper ARIA modal dialog semantics on the queue panel (trap focus, `aria-modal="true"`, `role="dialog"`, Escape key to close).

### L11 — No "confirm before leaving" on Settings page
Navigating away from Settings without saving silently discards unsaved changes (see H7 for the primary fix). Additionally, the browser's native `beforeunload` event should be used as a fallback.

### L12 — Player: Stop is not confirmed, but Clear Queue is
Stop stops playback immediately with no confirmation. Clear Queue shows a confirmation modal. These destructive actions should be handled consistently.
**Fix:** Either add a Stop confirmation, or remove the Clear Queue confirmation (and rely on a brief undo window instead).

### L13 — Album detail back button has no label on mobile
The back button on mobile is a bare left-arrow icon with no text label.
**Fix:** Add a "Library" or "Back" text label next to the back arrow on mobile.

### L14 — "Allow Play" party mode label should say "Allow Play/Pause"
The `allowPlay` permission controls both play and pause. The label only says "Allow Play."
**Fix:** Rename to "Allow Play / Pause" in the Party Mode settings UI.

### L15 — Admin Settings: no bulk "Remove all folders" action
There is no way to clear all music folders at once.
**Fix:** Add a "Remove all folders" action with a confirmation prompt.

---

## Summary Table

| ID | Priority | Area | Short Description |
|----|----------|------|-------------------|
| C1 | 🔴 Critical | Code | `classic-library` missing `'use client'` crashes dev server |
| C2 | 🔴 Critical | Player | Play Album duplicates first track in queue |
| C3 | 🔴 Critical | Recently Played | "FOO" debug string visible in heading |
| H1 | 🟠 High | Party Mode | Silent failures when actions are blocked |
| H2 | 🟠 High | Playlists | Play Playlist clears queue without warning |
| H3 | 🟠 High | Playlists | No "Add to Queue" option for playlists |
| H4 | 🟠 High | Party Mode | No visible Party Mode status indicator |
| H5 | 🟠 High | Security | No PIN brute-force protection |
| H6 | 🟠 High | UX | Track duration never displayed |
| H7 | 🟠 High | Settings | No unsaved-changes warning |
| H8 | 🟠 High | Settings | Inconsistent auto-save vs. manual-save behavior |
| H9 | 🟠 High | Party Mode | `allowPrevious` setting has no UI control |
| H10 | 🟠 High | Party Mode | `allowSkipInQueue` key not enforced |
| M1 | 🟡 Medium | Admin | Audio engine labels too technical |
| M2 | 🟡 Medium | Admin | PIN field accepts non-numeric input |
| M3 | 🟡 Medium | Settings | Missing descriptions on UI toggle settings |
| M4 | 🟡 Medium | Admin | Scan console log visible to all users |
| M5 | 🟡 Medium | Admin | No "Add & Scan" combined action |
| M6 | 🟡 Medium | Admin | No path validation before scanning |
| M7 | 🟡 Medium | Settings | Multiple Save buttons with unclear scope |
| M8 | 🟡 Medium | Library | Empty letter filter shows blank grid |
| M9 | 🟡 Medium | Recently Played | "Chronological order" is misleading |
| M10 | 🟡 Medium | Recently Played | Only 10 tracks shown, no load more |
| M11 | 🟡 Medium | Queue | Track count excludes currently-playing track |
| M12 | 🟡 Medium | Queue | Drag-to-reorder broken on mobile |
| M13 | 🟡 Medium | Now Playing | No queue preview or volume in overlay |
| M14 | 🟡 Medium | Now Playing | Progress shown as % only, not mm:ss |
| M15 | 🟡 Medium | Album Detail | AdminAlbumManager appears at top of page |
| M16 | 🟡 Medium | Album Detail | Setlist missing from side-by-side layout |
| M17 | 🟡 Medium | Security | System logs exposed on unprotected Settings |
| M18 | 🟡 Medium | Code | `/classic-library` route is redundant |
| M19 | 🟡 Medium | Admin | "Jukebox Name" missing description |
| M20 | 🟡 Medium | Settings | Auto-show overlay timeout not configurable |
| L1 | 🟢 Low | Library | No sort options |
| L2 | 🟢 Low | Library | Album/track count not visible on main page |
| L3 | 🟢 Low | Player | "Ready" state confusing on mobile |
| L4 | 🟢 Low | Player | No volume slider on desktop |
| L5 | 🟢 Low | Library | No visual affordance on album cards |
| L6 | 🟢 Low | Library | Empty letter buttons not visually distinguished |
| L7 | 🟢 Low | Recently Played | No absolute date for old timestamps |
| L8 | 🟢 Low | Playlists | No album art preview on playlist cards |
| L9 | 🟢 Low | Code | `onKeyPress` is deprecated |
| L10 | 🟢 Low | Accessibility | Queue modal missing proper ARIA dialog |
| L11 | 🟢 Low | Settings | No `beforeunload` protection on settings |
| L12 | 🟢 Low | Player | Stop/Clear Queue confirmation inconsistency |
| L13 | 🟢 Low | Mobile | Back button has no label on mobile |
| L14 | 🟢 Low | Party Mode | "Allow Play" label should say "Allow Play/Pause" |
| L15 | 🟢 Low | Admin | No bulk "Remove all folders" action |

---
---

# Code & UX Review — 2026-06-17

> Second-pass review focused on source code (security, architecture, type
> safety) and the core playback UI surfaces, complementing the UI-walkthrough
> review above. New IDs are prefixed `CR-` to avoid collision with the items
> above. Where a finding overlaps an existing item, it is cross-referenced.

## 🔴 Security

### CR-S1 — Admin PIN is exposed in plaintext to every client
`GET /api/settings` returns `adminPin` in the JSON body
(`app/api/settings/route.ts:194`, default-path `:49`). Anyone on the network can
`curl /api/settings` and read the PIN directly, which defeats Party Mode's lock
entirely. This is more severe than H5 (brute-force) — no guessing is needed.
Additionally, the PIN is written to application logs in plaintext on every save
(`saveSettings` logs the full settings object — `route.ts:120, 132, 141`).
**Fix:** Never send `adminPin` to the client — strip it from all GET responses.
Store a salted hash and verify server-side only. Scrub the PIN from log output.
Then layer on H5 rate-limiting. (Do this first.)

### CR-S2 — Path traversal on `POST /api/queue`
The `path` field from the request body is passed straight to
`queueState.addToQueue` with no validation (`app/api/queue/route.ts:73`). A
caller could pass `../../../../etc/...` to reach files outside the music library.
**Fix:** Resolve the incoming path and verify it is inside one of the configured
`scanPath` roots before using it. Apply the same guard to
`/api/cover-for-track` and any other route that takes a filesystem path.

### CR-S3 — Non-constant-time PIN comparison
`verify-pin/route.ts:43` compares with `pin === adminPin`. Minor next to CR-S1,
but worth a constant-time compare once the PIN is hashed.

## 🟠 High — Architecture & Correctness

### CR-A1 — `Settings` type is duplicated 4+ times and the copies conflict
There is a canonical `Settings` in `types/music.ts`, but API routes redeclare
their own partial/divergent versions (`app/api/settings/route.ts:6`,
`app/api/queue/route.ts:12`, `verify-pin/route.ts:5`). They already disagree:
the settings route declares `audioPlayer: 'vlc' | 'mpv' | 'ffplay'`, but the
app's actual default player is `'afplay'` (`SettingsContext.tsx:31`) — the
server type cannot even represent the default value, and `'mpv'`/`'ffplay'`
appear to be dead.
**Fix:** One `Settings` type in `types/music.ts`, imported everywhere. Delete
the redeclarations.

### CR-A2 — Player state is polled every 500ms instead of streamed
`Player.tsx:145` polls `/api/queue` every 500ms (≈120 req/min per browser tab,
multiplied by every open tab), plus a 5s `checkAudioState` poll. An SSE pattern
already exists in `/api/scan/progress` and should replace this.
**Fix:** Push player state over SSE; drop the interval polling.

### CR-A3 — `window.*` used as a cross-component event bus
`Player.tsx:31-33, 187-192` and `page.tsx:17-19, 110-119` attach
`window.checkPlayerStatusImmediately` and `window.hasAddedTrackToQueue` to
signal between components. This bypasses React, is invisible to DevTools, and
breaks across tabs.
**Fix:** Replace with context/state (see CR-A4).

### CR-A4 — `PlayerContext` is nearly empty; player state is trapped in `Player.tsx`
`contexts/PlayerContext.tsx` holds only `currentTrackPath`. All real player
state (`isPlaying`, `queue`, `progress`, `volume`) lives in `Player.tsx` local
state, forcing other components to poll the API themselves or use the `window`
hack (CR-A3).
**Fix:** Lift the polling/streaming into `PlayerContext` so the whole app can
subscribe. This also unblocks the Now Playing "Up Next" work (CR-U3) cleanly.

### CR-A5 — `isMobile`/resize dependency loop recreates polling intervals
`Player.tsx:74-82` updates `isMobile` on every window `resize`, and `isMobile`
is a dependency of the polling effect (`:152`). Every resize tears down and
recreates the 500ms + 5s intervals, briefly running duplicate concurrent
intervals.
**Fix:** Decouple the mobile check from the polling effect (separate effects;
don't make interval setup depend on `isMobile`).

## 🟡 Medium — Code Quality

### CR-A6 — Settings read from disk on every API request
`app/api/queue/route.ts:20-31` (and other routes) call `fs.readFileSync` +
`JSON.parse` on every request. **Fix:** Cache settings in memory and invalidate
on write, as the queue module already does for queue state.

### CR-A7 — `/api/settings` route has heavy duplication
`GET` reimplements the merge logic inline instead of calling `loadSettings()`,
and `PUT` and `POST` are near-identical copies of each other
(`route.ts:230-302`). **Fix:** Collapse to one shared merge/save helper.

### CR-A8 — `fetchStatusImmediately` duplicates the poll function
`Player.tsx:157-185` is a near-verbatim copy of the `pollStatus` body inside the
polling effect. **Fix:** Share one function.

### CR-A9 — `canPerformAction` is a fresh function reference each render
`SettingsContext.tsx:111` returns a plain function in context value, producing a
new reference every render and risking needless child re-renders. **Fix:**
`useCallback`/`useMemo` the context value.

### CR-A10 — Dead placeholder comments and debug logging throughout
Empty comment blocks describing never-built features (`Player.tsx:103-110,
281-284, 316-321`), `console.log` on every render (`page.tsx:39`), and verbose
`logger.info` instrumentation across `queue-state.ts` and the settings routes
read like debugging scaffolding. **Fix:** Remove dead comments; gate verbose
logging behind a debug flag.

### CR-A11 — Toolchain is dated
`tsconfig.json` targets `es5` (unnecessarily old for Next 14 — bump to `es2017`+)
and `next` is pinned to `14.0.0`, the very first 14.x release, missing many
patch fixes. **Fix:** Bump the TS target and at least patch-update Next.

## 🟠 High — UI/UX (Playback Surfaces)

> Context: this is a shared, often touchscreen, often party device. Clarity and
> comfort on the playback surfaces matter more than library chrome.

### CR-U1 — Playback time is shown as a percentage everywhere
The player bar shows `Playing (73%)` (`Player.tsx:547`) and the Now Playing
overlay shows `73%` (`NowPlayingOverlay.tsx:120`). Users think in `2:14 / 3:38`,
never percent. The `duration` data already exists on the track and in the
`QueueTrack` type. Extends/supersedes M14 (which only covered the overlay).
**Fix:** Show `mm:ss / mm:ss` in the player bar, the Now Playing overlay, and
next to each queue row. Highest impact-to-effort ratio in the app — do first.

### CR-U2 — Now Playing overlay closes when you tap the album art
The whole overlay is a click-to-dismiss target; only the controls
`stopPropagation` (`NowPlayingOverlay.tsx:63, 81-106`). Tapping the album cover —
the universal play/pause gesture — dismisses the screen instead. On a
touchscreen this fires constantly and feels broken.
**Fix:** Make album-art tap = play/pause. Dismiss only via the close button, a
swipe-down, or tapping the dimmed backdrop outside the content area.

### CR-U3 — Now Playing overlay wastes its space (no Up Next, volume, or time)
The overlay already receives the `queue` prop but only uses `queue.length` to
disable Skip. The app's most prominent screen shows no upcoming tracks, no
volume control, and no elapsed/total time — the three things a crowd wants.
Overlaps M13 but this is the centerpiece screen, so prioritize it.
**Fix:** Add an "Up Next" list (next 2–3 tracks), a volume slider, and `mm:ss`
time (CR-U1) to the overlay.

### CR-U4 — No first-run / empty state and no loading skeleton on the library
A fresh install with nothing scanned returns `[]` and renders a blank grid
(`page.tsx:86`); the page shows nothing structured while `isLoading`. The first
impression of the app is emptiness.
**Fix:** Add a welcoming empty state with a "Scan your music to begin" CTA, and a
skeleton loader while albums load.

## 🟡 Medium — UI/UX

### CR-U5 — Queue has no clear "Now Playing" anchor
The currently-playing track is only highlighted if it still happens to be in the
queue array (`Queue.tsx:248`); otherwise the queue view gives no indication of
what is playing right now.
**Fix:** Pin a "Now Playing" header row at the top of the queue panel.

### CR-U6 — Queue rows have two redundant play affordances
Each row offers both the track-number button (`Queue.tsx:262`) and a separate
play button (`:301`), both calling `handlePlayTrack`. Confusing.
**Fix:** Make the number a plain number; keep one clear play button.

### CR-U7 — Mobile users cannot skip from the player bar
The Skip button is hidden entirely on mobile (`Player.tsx:688`), so a phone user
must open the Now Playing overlay to skip.
**Fix:** Show Skip on mobile (or otherwise expose skip from the bar).

## Summary Table (2026-06-17 review)

| ID | Priority | Area | Short Description |
|----|----------|------|-------------------|
| CR-S1 | 🔴 Critical | Security | Admin PIN returned in plaintext by GET /api/settings + logged |
| CR-S2 | 🔴 Critical | Security | Path traversal on POST /api/queue (and path-taking routes) |
| CR-S3 | 🟡 Medium | Security | Non-constant-time PIN comparison |
| CR-A1 | 🟠 High | Types | `Settings` type duplicated 4+ times and copies conflict |
| CR-A2 | 🟠 High | Perf | Player polls /api/queue every 500ms instead of SSE |
| CR-A3 | 🟠 High | Arch | `window.*` used as a cross-component event bus |
| CR-A4 | 🟠 High | Arch | `PlayerContext` nearly empty; state trapped in Player.tsx |
| CR-A5 | 🟠 High | Bug | isMobile/resize dep loop recreates polling intervals |
| CR-A6 | 🟡 Medium | Perf | Settings read from disk on every API request |
| CR-A7 | 🟡 Medium | Code | /api/settings GET/PUT/POST duplication |
| CR-A8 | 🟡 Medium | Code | fetchStatusImmediately duplicates poll function |
| CR-A9 | 🟡 Medium | Perf | canPerformAction is a fresh function ref each render |
| CR-A10 | 🟡 Medium | Code | Dead placeholder comments and debug logging |
| CR-A11 | 🟡 Medium | Build | tsconfig es5 target; next pinned to 14.0.0 |
| CR-U1 | 🟠 High | Playback UI | Time shown as percentage instead of mm:ss everywhere |
| CR-U2 | 🟠 High | Playback UI | Now Playing overlay closes when tapping album art |
| CR-U3 | 🟠 High | Playback UI | Now Playing overlay has no Up Next / volume / time |
| CR-U4 | 🟠 High | Library | No first-run empty state or loading skeleton |
| CR-U5 | 🟡 Medium | Queue | No clear "Now Playing" anchor in queue panel |
| CR-U6 | 🟡 Medium | Queue | Two redundant play buttons per queue row |
| CR-U7 | 🟡 Medium | Mobile | Skip button hidden on mobile player bar |

## Suggested first batch (self-contained, high impact)

1. **CR-S1 + CR-S2 + CR-A1** — security + type-safety pass (all small).
2. **CR-U1** — mm:ss time across player bar, overlay, queue.
3. **CR-U2 + CR-U3** — fix overlay tap-to-close; add Up Next + volume + time.
4. **CR-U5 + CR-U6** — queue Now Playing header; drop duplicate play button.
