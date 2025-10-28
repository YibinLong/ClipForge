# ClipForge — Product Requirements Document

## 1. Project Summary

**ClipForge** is a native desktop video editor inspired by CapCut, designed to make professional video editing accessible and intuitive. Users can record their screen and webcam, import video clips, arrange them on a visual timeline, trim and split content, and export high-quality MP4 videos — all within a single desktop application.

**MVP Scope:** Video import (drag & drop), basic timeline editing (trim, arrange), video preview playback, and MP4 export.

**Context:** This is a compressed 72-hour sprint with two critical deadlines:
- **MVP Checkpoint:** Tuesday, October 28th at 10:59 PM CT
- **Final Submission:** Wednesday, October 29th at 10:59 PM CT

The project transforms complex video editing workflows into a streamlined desktop experience, proving that creators can record, edit, and export professional content without leaving the app.

---

## 2. Core Goals

Users can:

1. **Record screen and webcam content** directly within the app, with simultaneous picture-in-picture support and microphone audio capture.
2. **Import video files** via drag-and-drop or file picker, seeing thumbnail previews and metadata in a media library.
3. **Arrange and edit clips on a visual timeline** with drag, trim, split, delete, and multi-track support.
4. **Preview their composition in real-time** with synchronized audio and smooth playback controls.
5. **Export finished videos to MP4** with resolution options (720p, 1080p, source) and progress tracking.

---

## 3. Non-Goals

The following are **explicitly out of scope** for MVP:

- Advanced video effects (filters, color grading, chroma key)
- Cloud storage integration or online publishing
- Multi-user collaboration or project sharing
- Mobile or web versions
- Transitions beyond basic cuts (fade, slide animations are stretch goals)
- Audio-only editing or podcast workflows
- Real-time collaboration features
- Plugin/extension system
- Video compression optimization beyond FFmpeg defaults
- Support for proprietary formats (Premiere, Final Cut Pro project files)

---

## 4. Tech Stack (Solo-AI Friendly)

| **Layer**         | **Technology**                                      | **Rationale**                                                                 |
|-------------------|-----------------------------------------------------|-------------------------------------------------------------------------------|
| **Desktop**       | Electron + Electron Forge (Webpack template)        | Mature ecosystem, excellent documentation, cross-platform out-of-the-box      |
| **Frontend**      | React + TypeScript                                  | Type safety reduces bugs, component model fits timeline/media panels well     |
| **Timeline UI**   | Konva.js (canvas-based)                             | High-performance canvas rendering for drag/drop, zoom, and scrubbing          |
| **Media Processing** | ffmpeg-static + fluent-ffmpeg                    | Pre-bundled FFmpeg binary (no external install), fluent API for encoding      |
| **Video Player**  | HTML5 `<video>` element                             | Native browser support, simple API, reliable playback                         |
| **Recording**     | Electron desktopCapturer API + getUserMedia         | Built into Electron, supports screen/window selection and webcam access       |
| **Packaging**     | Electron Forge (built-in)                           | Zero-config packaging for macOS, Windows, Linux                               |
| **Styling**       | TailwindCSS                                         | Utility-first CSS, rapid prototyping, no custom CSS files needed              |
| **State**         | Zustand                                             | Lightweight (~1KB), simple API, no boilerplate, perfect for timeline state    |
| **Persistence**   | electron-store + Node.js fs                         | JSON-based project storage, native file system access for video files         |

**Stack Compatibility Notes:**
- Electron Forge Webpack template includes React + TypeScript out-of-the-box
- ffmpeg-static works seamlessly in Electron's main process (Node.js context)
- Konva.js renders in React components via react-konva wrapper
- Zustand integrates cleanly with React hooks
- TailwindCSS supports Electron/Webpack via PostCSS

---

## 5. Feature Breakdown — Vertical Slices

### **Feature 1: Recording (Screen, Webcam, Audio)**

**User Story:**  
As a content creator, I want to record my screen, webcam, and microphone simultaneously so that I can create tutorial videos without external recording software.

**Acceptance Criteria:**
- [ ] User clicks "Record Screen" and selects a screen or window via Electron desktopCapturer
- [ ] User clicks "Record Webcam" and accesses system camera via getUserMedia
- [ ] User enables "Picture-in-Picture" mode to record screen + webcam simultaneously
- [ ] Microphone audio is captured alongside video
- [ ] Recording controls (Start, Stop, Pause) are visible and functional
- [ ] Stopped recordings automatically appear in the media library and timeline
- [ ] Recordings are saved to a temp directory with unique filenames (e.g., `recording_TIMESTAMP.webm`)

**Data Model Notes:**
- Recordings stored in `userData/recordings/` directory
- Media library state tracks: `{ id, filename, path, duration, thumbnail, type: 'recording' }`
- Timeline state includes recording clips with same schema as imported clips

**API Endpoints (IPC Channels):**
- `get-sources` → Returns list of screen/window sources from desktopCapturer
- `start-recording` → Initiates MediaRecorder with specified source
- `stop-recording` → Stops recorder, saves file, returns file path
- `save-recording` → Moves temp recording to userData directory

**Edge Cases & Errors:**
- macOS permissions not granted → Show alert with instructions to enable Screen Recording in System Preferences
- No microphone detected → Allow video-only recording, show warning
- Disk space low → Check available space before recording, warn if <1GB free
- Recording fails mid-session → Save partial recording, notify user
- Simultaneous recordings → Disable "Start" button while recording in progress

---

### **Feature 2: Import & Media Management**

**User Story:**  
As a video editor, I want to import existing video files from my computer so that I can combine them with my recordings on the timeline.

**Acceptance Criteria:**
- [ ] User drags MP4/MOV/WebM files onto the app and they appear in media library
- [ ] User clicks "Import" button to open file picker for video selection
- [ ] Media library displays thumbnail preview for each clip
- [ ] Metadata shown: filename, duration (MM:SS), resolution (e.g., 1920x1080), file size (MB)
- [ ] Clicking a media library clip plays preview in the main preview player
- [ ] Media library persists across app restarts via electron-store

**Data Model Notes:**
- Media library schema: `{ id: string, filename: string, path: string, duration: number, width: number, height: number, size: number, thumbnail: string (base64 or path) }`
- Stored in electron-store under key `mediaLibrary: MediaClip[]`

**API Endpoints (IPC Channels):**
- `import-file` → Receives file path, extracts metadata via FFmpeg, generates thumbnail, returns clip object
- `get-video-metadata` → Uses ffprobe (via fluent-ffmpeg) to read duration, resolution
- `generate-thumbnail` → Extracts frame at 1-second mark using FFmpeg

**Edge Cases & Errors:**
- Unsupported format → Show error toast "Format not supported. Please use MP4, MOV, or WebM."
- Corrupted file → Catch FFmpeg error, display "Unable to read file."
- Duplicate import → Check if path already exists in media library, skip or warn user
- File moved/deleted → On app load, validate all paths, mark missing files with error state
- Large files (>2GB) → Import successfully but warn about potential performance issues

---

### **Feature 3: Timeline Editor**

**User Story:**  
As a video editor, I want to arrange clips on a visual timeline with precise control over timing and order so that I can craft my final video composition.

**Acceptance Criteria:**
- [ ] Timeline displays as horizontal canvas with time ruler (00:00, 00:10, etc.)
- [ ] Playhead (vertical red line) indicates current time position
- [ ] User drags clips from media library onto timeline tracks
- [ ] Clips snap to track boundaries and adjacent clip edges
- [ ] User drags clip edges to trim start/end points (non-destructive)
- [ ] User clicks "Split" button to cut clip at playhead position
- [ ] User selects clip and presses Delete/Backspace to remove from timeline
- [ ] Timeline supports at least 2 tracks: Main Video (Track 1) and Overlay/PiP (Track 2)
- [ ] Zoom controls (+ / - buttons or scroll wheel) adjust timeline scale for precision
- [ ] Timeline scrolls horizontally for long compositions

**Data Model Notes:**
- Timeline state (Zustand): `{ clips: TimelineClip[], playheadPosition: number, zoomLevel: number }`
- TimelineClip schema: `{ id, mediaId, trackId, startTime, endTime, trimStart, trimEnd, x, y, width, height }`

**API Endpoints (IPC Channels):**
- `save-timeline` → Saves current timeline JSON to electron-store or project file
- `load-timeline` → Loads timeline state from storage

**Edge Cases & Errors:**
- Overlapping clips on same track → Push existing clips forward or show error
- Trim beyond clip bounds → Clamp trim values to [0, duration]
- Delete last clip → Allow deletion, show empty timeline
- Zoom too far in/out → Clamp zoom level to reasonable range (e.g., 1x to 10x)
- Drag clip outside timeline bounds → Snap back to valid position

---

### **Feature 4: Preview & Playback**

**User Story:**  
As a video editor, I want to preview my timeline composition in real-time with synchronized audio so that I can review my edits before exporting.

**Acceptance Criteria:**
- [ ] Preview player (HTML5 `<video>`) displays current frame at playhead position
- [ ] Play button starts playback, syncing playhead movement with video
- [ ] Pause button stops playback at current position
- [ ] User drags playhead (scrubbing) to jump to any time, video updates immediately
- [ ] Audio from all clips plays in sync with video
- [ ] Timeline highlights active clip(s) during playback
- [ ] Playback stops automatically at timeline end

**Data Model Notes:**
- Playback state (Zustand): `{ isPlaying: boolean, currentTime: number, duration: number }`
- Preview rendering: Composite video segments based on timeline clip positions

**API Endpoints (IPC Channels):**
- `render-preview-frame` → Generates composite frame for given timestamp (if using canvas preview)
- For MVP: Use simple `<video>` with src switching based on playhead position

**Edge Cases & Errors:**
- Playhead between clips (gap) → Show black frame or last frame of previous clip
- Audio desync → Ensure `<video>` element's currentTime stays synchronized with playhead
- Playback stutters → Preload adjacent clips, use buffering strategy
- Fast scrubbing → Debounce scrub updates to avoid excessive re-renders

---

### **Feature 5: Export & Rendering**

**User Story:**  
As a content creator, I want to export my timeline composition to a high-quality MP4 file so that I can share it on YouTube, social media, or save it locally.

**Acceptance Criteria:**
- [ ] User clicks "Export" button and selects output resolution (720p, 1080p, or Source)
- [ ] File save dialog opens for user to choose export location and filename
- [ ] Export progress bar shows percentage and estimated time remaining
- [ ] FFmpeg processes timeline: concatenates clips, applies trims, encodes to MP4
- [ ] Exported video plays correctly in external media players (VLC, QuickTime)
- [ ] User receives notification when export completes
- [ ] Export can be cancelled mid-process

**Data Model Notes:**
- Export job schema: `{ outputPath: string, resolution: string, progress: number, status: 'idle' | 'processing' | 'complete' | 'error' }`

**API Endpoints (IPC Channels):**
- `start-export` → Receives timeline data, resolution, output path; starts FFmpeg encoding
- `export-progress` → Sends progress updates (0-100%) to renderer
- `cancel-export` → Terminates FFmpeg process
- `export-complete` → Notifies renderer when encoding finishes

**Edge Cases & Errors:**
- Export fails (FFmpeg error) → Show error message with FFmpeg log details
- Insufficient disk space → Check available space before export, warn if too low
- Invalid output path → Validate path, prompt user to choose valid location
- Export cancelled → Delete partial output file, reset UI state
- Timeline empty → Disable Export button, show "Add clips to timeline first"
- Clips with different resolutions → Scale all to target resolution or use source resolution of first clip

---

## 6. System Design (Lightweight)

**ClipForge** follows Electron's process model with clear separation between the **Main Process** (Node.js) and **Renderer Process** (React UI).

**Main Process** handles:
- FFmpeg operations (encoding, metadata extraction, thumbnail generation)
- File system access (reading/writing video files, project JSON)
- IPC message routing between renderer and native APIs
- Screen/webcam recording coordination via desktopCapturer
- Persistence via electron-store

**Renderer Process** manages:
- React UI components (media library, timeline, preview player, controls)
- Konva.js canvas rendering for timeline (drag/drop, zoom, scrubbing)
- State management via Zustand (timeline clips, playback position, media library)
- User interactions (play/pause, trim, split, export trigger)

**Data Flow:**
1. User imports video → Renderer sends IPC `import-file` → Main extracts metadata with FFmpeg → Returns clip object → Renderer adds to Zustand state
2. User arranges timeline → State updates in Zustand → Auto-saved to electron-store via IPC
3. User exports → Renderer sends timeline JSON via IPC → Main constructs FFmpeg command → Streams progress updates → Returns final file path

**FFmpeg Processing:**
- Thumbnail generation: `ffmpeg -i input.mp4 -ss 1 -vframes 1 thumbnail.jpg`
- Export: Build complex filter graph for concatenation, trimming, scaling based on timeline data
- Runs in Main process to avoid blocking UI

---

## 7. Detailed Requirements

### **Core Libraries**
- `electron` (^28.0.0) — Desktop app framework
- `@electron-forge/cli` — Build and packaging toolchain
- `react` (^18.2.0), `react-dom` — UI framework
- `zustand` (^4.4.0) — State management
- `konva` (^9.2.0), `react-konva` (^18.2.0) — Canvas-based timeline rendering
- `fluent-ffmpeg` (^2.1.2) — FFmpeg wrapper for Node.js
- `ffmpeg-static` (^5.2.0) — Pre-bundled FFmpeg binary
- `electron-store` (^8.1.0) — Simple data persistence
- `tailwindcss` (^3.3.0) — Utility-first CSS framework

### **File Handling & Encoding**
- **Import:** Use dialog.showOpenDialog for file picker, accept `.mp4`, `.mov`, `.webm`
- **Recording:** Save to `userData/recordings/` with timestamp-based naming
- **Export:** Use fluent-ffmpeg to build filter_complex for multi-clip concatenation, trimming, and scaling
- **Thumbnails:** Extract first frame or frame at 1s mark, store as base64 or file path
- **Project Files:** Save timeline JSON to `userData/projects/` for reloading sessions

### **Security Considerations**
- **IPC Validation:** Validate all file paths from renderer before file operations
- **Path Sanitization:** Use `path.normalize()` and check paths stay within userData directory
- **Context Isolation:** Enable `contextIsolation: true` in BrowserWindow
- **Preload Script:** Expose only necessary IPC methods via `contextBridge`

### **Performance Expectations**
- Timeline UI remains responsive with 10+ clips (60fps canvas rendering)
- Preview playback targets 30fps minimum
- Export completes without crashes, even for 10-minute timelines
- App launch time under 5 seconds
- No memory leaks during 15+ minute editing sessions (monitor via Task Manager)

### **Accessibility**
- Keyboard shortcuts:
  - `Space` → Play/Pause
  - `Delete/Backspace` → Delete selected clip
  - `Cmd/Ctrl + Z` → Undo (stretch goal)
  - `Cmd/Ctrl + S` → Save project
  - `Cmd/Ctrl + E` → Export
- Readable UI with 14px minimum font size
- Clear visual feedback for all interactions (hover states, selection highlights)
- High contrast between timeline elements (clips, playhead, background)

---

## 8. .env Setup

**Example `.env` file (optional for MVP):**

```env
# Debug Mode
DEBUG=true

# FFmpeg Path (override if not using ffmpeg-static)
# FFMPEG_PATH=/usr/local/bin/ffmpeg

# Log Level (error, warn, info, debug)
LOG_LEVEL=info

# User Data Directory (override default)
# USER_DATA_PATH=/custom/path
```

**Notes:**
- Most configuration lives in `package.json` and `forge.config.js`
- ffmpeg-static provides binary path automatically via `require('ffmpeg-static')`
- electron-store uses `app.getPath('userData')` by default
- `.env` primarily used for debug flags during development

---

## 9. .gitignore

```gitignore
# Dependencies
node_modules/
package-lock.json
yarn.lock

# Build outputs
dist/
out/
.webpack/

# Environment
.env
.env.local

# OS files
.DS_Store
Thumbs.db
desktop.ini

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Logs
logs/
*.log
npm-debug.log*

# Electron
userData/
recordings/
projects/

# Temp files
tmp/
temp/
*.tmp

# FFmpeg outputs
*.webm.tmp
*.mp4.tmp
```

---

## 10. Debugging & Logging

### **Main Process Logging**
- Use `console.log()` for development (outputs to terminal where `npm start` runs)
- For production builds, write logs to file: `app.getPath('userData')/logs/main.log`
- Log all IPC calls with parameters for debugging: `console.log('[IPC]', channel, args)`

### **Renderer Process Logging**
- Standard `console.log()` visible in Chrome DevTools
- Open DevTools: `View → Toggle Developer Tools` or `Cmd/Ctrl + Shift + I`
- Enable React DevTools for component inspection

### **Debug Mode**
- Check `DEBUG=true` in `.env` to enable verbose logging
- Show additional UI overlays (e.g., playhead time, FPS counter)
- Disable in production builds

### **Error Tracking**
- Wrap IPC handlers in try-catch blocks
- Send errors to renderer via IPC: `mainWindow.webContents.send('error', errorMessage)`
- Display error toasts in UI with actionable messages
- Log full stack traces to console/file for debugging

### **DevTools Access**
- Enable in development: `mainWindow.webContents.openDevTools()`
- Disable in production unless DEBUG=true

---

## 11. External Setup Instructions (Manual)

### **macOS Permissions (Required for Recording)**

**Screen Recording Permission:**
1. Go to `System Preferences → Security & Privacy → Privacy → Screen Recording`
2. Click the lock icon to make changes
3. Check the box next to ClipForge (or Electron) to allow screen recording
4. Restart the app if permission was just granted

**Microphone Permission:**
1. Go to `System Preferences → Security & Privacy → Privacy → Microphone`
2. Enable ClipForge (or Electron)
3. Restart the app if permission was just granted

**Why:** macOS requires explicit user consent for screen and microphone access. The app will prompt automatically on first use, but users may need to manually enable if denied initially.

### **Windows Permissions**
- No manual setup required for screen recording
- Microphone access may trigger Windows permission prompt on first use

### **Linux Permissions**
- Screen recording may require XDG Desktop Portal support
- Install `pipewire` or `xdg-desktop-portal` for Wayland compatibility

### **FFmpeg Installation**
- **Not required!** The app bundles `ffmpeg-static`, which includes a pre-compiled FFmpeg binary
- Binary path accessed via `require('ffmpeg-static')` in code

### **First-Time Setup Checklist**
1. Clone repository
2. Run `npm install`
3. (macOS) Grant Screen Recording and Microphone permissions when prompted
4. Run `npm start` to launch in dev mode
5. Test import by dragging an MP4 file into the app

---

## 12. Deployment Plan

### **Local Development**

**Setup:**
```bash
# Clone repository
git clone <repo-url>
cd ClipForge

# Install dependencies
npm install

# Start development server
npm start
```

**Development Mode:**
- Electron app launches with hot-reloading enabled
- DevTools open automatically
- Changes to React components auto-refresh
- Changes to main process require app restart

### **Building Packaged App**

**Build Command:**
```bash
# Create distributable for current platform
npm run make
```

**Output:**
- macOS: `out/make/ClipForge-darwin-x64/ClipForge.app` + DMG in `out/make/`
- Windows: `out/make/squirrel.windows/x64/ClipForge.exe` + installer
- Linux: `out/make/deb/x64/clipforge_1.0.0_amd64.deb` (or rpm)

**Package Configuration:**
- Defined in `forge.config.js`
- Uses Electron Forge's built-in makers (Squirrel for Windows, DMG for macOS, deb/rpm for Linux)

### **Distribution via GitHub Releases**

1. Tag version: `git tag -a v1.0.0 -m "MVP Release"`
2. Push tag: `git push origin v1.0.0`
3. Run `npm run make` locally
4. Create GitHub Release and upload artifacts from `out/make/`
5. Include SHA-256 checksums for verification

**Alternative:** Use GitHub Actions to auto-build on tag push (stretch goal)

### **Testing Packaged App**

**Critical tests before distribution:**
- [ ] App launches without terminal/console
- [ ] Import video via drag-and-drop works
- [ ] Recording captures screen/webcam successfully
- [ ] Timeline editing (drag, trim, split) functions correctly
- [ ] Export produces valid MP4 playable in VLC/QuickTime
- [ ] App doesn't crash during 10-minute editing session
- [ ] File size of packaged app is reasonable (<200MB for macOS DMG)

**Platform Testing:**
- Build and test on macOS (primary target)
- Test on Windows if possible (use VM or separate machine)
- Linux testing optional for MVP

### **Deployment Checklist**
- [ ] Version bump in `package.json`
- [ ] Changelog updated (if maintaining one)
- [ ] All features tested in packaged build (not just dev mode)
- [ ] README includes download link and installation instructions
- [ ] Demo video recorded (3-5 minutes) showing full workflow
- [ ] GitHub Release created with binaries and instructions

---

## Final Notes for AI Implementation

**This PRD is the single source of truth for building ClipForge.** When implementing:

1. **Start with the MVP requirements** (Section 5, Features 2-5 simplified): Import → Timeline → Preview → Export
2. **Add Recording last** (Feature 1) — it's complex and not needed for initial proof-of-concept
3. **Test FFmpeg early** — encoding issues are the biggest risk; validate export with a single clip ASAP
4. **Use Electron Forge's official template** — `npx create-electron-app ClipForge --template=webpack-typescript`
5. **Install dependencies incrementally** — add libraries as you implement each feature, not all at once
6. **Follow the vertical slice approach** — get one feature fully working (import → display → export single clip) before moving to next

**Manual notifications required during implementation:**
- Installing dependencies: "Run `npm install zustand fluent-ffmpeg ffmpeg-static konva react-konva tailwindcss` to add required libraries."
- macOS permissions: "Before testing recording, enable Screen Recording permission in System Preferences."
- First export test: "When testing export, verify the output MP4 plays in VLC to confirm FFmpeg pipeline works."

**Remember:** The goal is a working desktop app that can be packaged and distributed. Prioritize **stability and completeness over feature richness**. A simple editor that reliably imports, edits, and exports beats a feature-packed app that crashes.

