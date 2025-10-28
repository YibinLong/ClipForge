# **ClipForge - Task List**

**Status Legend:** ⬜ Not Started | 🟦 In Progress | ✅ Done | ❌ Blocked

---

## **PHASE 1: PROJECT SETUP** 🟦

### **Epic 1.1: Initialize Electron Project** ✅

**Story:** Set up the foundational Electron application with proper TypeScript configuration

- ✅ **Task 1.1.1:** Run `npx create-electron-app clipforge --template=webpack-typescript`
- ✅ **Task 1.1.2:** Verify app launches with `npm start` and displays default window
- ✅ **Task 1.1.3:** Create folder structure: `src/main/`, `src/renderer/`, `src/types/`, `src/preload/`
- ✅ **Task 1.1.4:** Move main process files to `src/main/` and update webpack config paths
- ✅ **Task 1.1.5:** Move renderer files to `src/renderer/` and update entry points
- ✅ **Task 1.1.6:** Configure TypeScript `tsconfig.json` with strict mode and path aliases
- ✅ **Task 1.1.7:** Set up ESLint with TypeScript and React rules
- ✅ **Task 1.1.8:** Create `.gitignore` file (from PRD Section 9)
- ✅ **Task 1.1.9:** Create `env.example` file with debug flags (from PRD Section 8)
- ✅ **Task 1.1.10:** Test app still launches after reorganization

**Acceptance:** App runs with `npm start`, shows Electron window with "Hello World", folder structure organized, TypeScript compiles without errors. ✅

---

### **Epic 1.2: Core Dependencies Installation** ✅

**Story:** Install all required libraries for UI, state management, styling, and media processing

- ✅ **Task 1.2.1:** Install React dependencies: `npm install react@^18.2.0 react-dom@^18.2.0`
- ✅ **Task 1.2.2:** Install state management: `npm install zustand@^4.4.0`
- ✅ **Task 1.2.3:** Install TailwindCSS: `npm install -D tailwindcss@^3.3.0 postcss autoprefixer`
- ✅ **Task 1.2.4:** Initialize TailwindCSS: `npx tailwindcss init -p`
- ✅ **Task 1.2.5:** Configure Tailwind content paths in `tailwind.config.js` to include `src/**/*.{js,jsx,ts,tsx}`
- ✅ **Task 1.2.6:** Add Tailwind directives to main CSS file (`@tailwind base; @tailwind components; @tailwind utilities;`)
- ✅ **Task 1.2.7:** Install FFmpeg tools: `npm install fluent-ffmpeg@^2.1.2 ffmpeg-static@^5.2.0`
- ✅ **Task 1.2.8:** Install types: `npm install -D @types/fluent-ffmpeg`
- ✅ **Task 1.2.9:** Install Konva: `npm install konva@^9.2.0 react-konva@^18.2.0`
- ✅ **Task 1.2.10:** Install electron-store: `npm install electron-store@^8.1.0`
- ✅ **Task 1.2.11:** Test app runs and all dependencies resolve (`npm start`)
- ✅ **Task 1.2.12:** Create a simple React component with Tailwind classes to verify styling works

**Acceptance:** All dependencies installed, `npm start` runs without errors, TailwindCSS styling applies to React components, no dependency warnings. ✅

---

### **Epic 1.3: IPC Infrastructure** ✅

**Story:** Set up secure communication between main and renderer processes using context isolation

- ✅ **Task 1.3.1:** Enable `contextIsolation: true` and `nodeIntegration: false` in BrowserWindow config
- ✅ **Task 1.3.2:** Create `src/preload/preload.ts` with contextBridge setup
- ✅ **Task 1.3.3:** Define IPC channel names as constants in `src/types/ipc.ts`
- ✅ **Task 1.3.4:** Create type definitions for IPC messages in `src/types/ipc.ts`
- ✅ **Task 1.3.5:** Expose IPC methods via contextBridge (e.g., `window.electron.invoke()`)
- ✅ **Task 1.3.6:** Create IPC handler utilities in `src/main/ipc/` directory
- ✅ **Task 1.3.7:** Implement test IPC handler: `test-message` (ping/pong)
- ✅ **Task 1.3.8:** Create React hook or utility for calling IPC from renderer
- ✅ **Task 1.3.9:** Test IPC call from renderer button → main → back to renderer with response
- ✅ **Task 1.3.10:** Add error handling for IPC calls (try-catch in handlers)

**Acceptance:** Can send message from renderer to main and receive response, contextBridge exposes only intended APIs, TypeScript types prevent invalid IPC calls. ✅

---

## **PHASE 2: MEDIA IMPORT & PREVIEW (MVP Core)** ⬜

### **Epic 2.1: File Import System** ✅

**Story:** Allow users to import video files into the application via file picker or drag-and-drop

- ✅ **Task 2.1.1:** Create IPC handler `import-file` in main process using `dialog.showOpenDialog()`
- ✅ **Task 2.1.2:** Configure file filters for `.mp4`, `.mov`, `.webm` formats
- ✅ **Task 2.1.3:** Return selected file path(s) to renderer via IPC response
- ✅ **Task 2.1.4:** Create `MediaLibrary` React component in `src/renderer/components/`
- ✅ **Task 2.1.5:** Add "Import Video" button that triggers IPC call to `import-file`
- ✅ **Task 2.1.6:** Display imported file paths in a simple list view
- ✅ **Task 2.1.7:** Implement drag-and-drop zone in MediaLibrary component
- ✅ **Task 2.1.8:** Handle `drop` event to extract file paths from DataTransfer
- ✅ **Task 2.1.9:** Validate dropped files are video formats (check extension)
- ✅ **Task 2.1.10:** Send dropped file paths to main process for processing
- ✅ **Task 2.1.11:** Add visual feedback for drag-over state (border highlight)

**Acceptance:** Can click "Import" to select video files, can drag-and-drop MP4/MOV/WebM files, file paths appear in media library list. ✅

---

### **Epic 2.2: FFmpeg Integration** ✅

**Story:** Extract video metadata and generate thumbnails using FFmpeg

- ✅ **Task 2.2.1:** Create `src/main/services/ffmpeg.ts` service module
- ✅ **Task 2.2.2:** Set FFmpeg path from `require('ffmpeg-static')` in ffmpeg.setFfmpegPath()
- ✅ **Task 2.2.3:** Implement `getVideoMetadata(filePath)` function using ffprobe
- ✅ **Task 2.2.4:** Extract duration, width, height, and file size from metadata
- ✅ **Task 2.2.5:** Implement `generateThumbnail(filePath, outputPath)` using FFmpeg
- ✅ **Task 2.2.6:** Configure thumbnail extraction at 1-second mark with single frame
- ✅ **Task 2.2.7:** Save thumbnails to `userData/thumbnails/` directory
- ✅ **Task 2.2.8:** Create `MediaClip` TypeScript interface in `src/types/media.ts`
- ✅ **Task 2.2.9:** Update `import-file` handler to call metadata extraction and thumbnail generation
- ✅ **Task 2.2.10:** Return complete MediaClip object (id, filename, path, duration, width, height, size, thumbnail)
- ✅ **Task 2.2.11:** Test with various video formats and resolutions
- ✅ **Task 2.2.12:** Add error handling for corrupted/unsupported files

**Acceptance:** Importing video extracts correct metadata (duration, resolution, file size), generates thumbnail image, returns complete MediaClip object. ✅

---

### **Epic 2.3: Video Preview Player** ✅

**Story:** Display imported videos in a preview player with basic playback controls

- ✅ **Task 2.3.1:** Create `VideoPlayer` component in `src/renderer/components/VideoPlayer.tsx`
- ✅ **Task 2.3.2:** Use HTML5 `<video>` element with `controls` attribute
- ✅ **Task 2.3.3:** Accept `src` prop for video file path (use `file://` protocol)
- ✅ **Task 2.3.4:** Create custom play/pause button overlay (styled with Tailwind)
- ✅ **Task 2.3.5:** Add time display showing `currentTime / duration` in MM:SS format
- ✅ **Task 2.3.6:** Implement custom progress bar (input range slider)
- ✅ **Task 2.3.7:** Sync progress bar with video currentTime
- ✅ **Task 2.3.8:** Allow seeking by clicking/dragging progress bar
- ✅ **Task 2.3.9:** Display selected clip from media library in VideoPlayer
- ✅ **Task 2.3.10:** Handle video load errors gracefully (show error message)
- ✅ **Task 2.3.11:** Add volume control slider

**Acceptance:** Clicking a media library clip loads it in preview player, can play/pause, see current time and duration, seek using progress bar. ✅

---

### **Epic 2.4: Media Library State** ⬜

**Story:** Manage media library state with Zustand and persist across app sessions

- ✅ **Task 2.4.1:** Create Zustand store in `src/renderer/stores/mediaStore.ts`
- ✅ **Task 2.4.2:** Define state shape: `{ clips: MediaClip[], selectedClipId: string | null }`
- ✅ **Task 2.4.3:** Implement `addClip(clip)` action
- ✅ **Task 2.4.4:** Implement `removeClip(clipId)` action
- ✅ **Task 2.4.5:** Implement `selectClip(clipId)` action
- ✅ **Task 2.4.6:** Connect MediaLibrary component to Zustand store
- ✅ **Task 2.4.7:** Update UI to show clips from store instead of local state
- ✅ **Task 2.4.8:** Create IPC handler `save-media-library` in main process
- ✅ **Task 2.4.9:** Use electron-store to persist media library JSON
- ✅ **Task 2.4.10:** Create IPC handler `load-media-library` to retrieve saved data
- ✅ **Task 2.4.11:** Load media library from electron-store on app startup
- ✅ **Task 2.4.12:** Validate file paths on load (check if files still exist)
- ✅ **Task 2.4.13:** Mark missing files with error state or remove them
- ✅ **Task 2.4.14:** Auto-save media library on every change (debounced)

**Acceptance:** Media library state managed by Zustand, persists to disk via electron-store, reloads on app restart, shows same clips after relaunch. ⬜

---

## **PHASE 3: TIMELINE FOUNDATION** ⬜

### **Epic 3.1: Timeline UI (Konva Canvas)** ⬜

**Story:** Build the visual timeline using Konva.js canvas with time ruler and playhead

- ⬜ **Task 3.1.1:** Create `Timeline` component in `src/renderer/components/Timeline.tsx`
- ⬜ **Task 3.1.2:** Set up Konva Stage and Layer with react-konva
- ⬜ **Task 3.1.3:** Define timeline dimensions (width: full viewport, height: 300px)
- ⬜ **Task 3.1.4:** Draw background rectangle for timeline area
- ⬜ **Task 3.1.5:** Implement time ruler with tick marks every 10 seconds
- ⬜ **Task 3.1.6:** Add time labels (00:00, 00:10, 00:20, etc.) above ruler
- ⬜ **Task 3.1.7:** Calculate ruler scale based on zoom level (pixels per second)
- ⬜ **Task 3.1.8:** Draw playhead as vertical red line (Konva Line)
- ⬜ **Task 3.1.9:** Make playhead draggable (Konva draggable property)
- ⬜ **Task 3.1.10:** Constrain playhead to horizontal axis only (dragBoundFunc)
- ⬜ **Task 3.1.11:** Create zoom controls (+/- buttons) above timeline
- ⬜ **Task 3.1.12:** Implement zoom in/out logic (increase/decrease pixelsPerSecond)
- ⬜ **Task 3.1.13:** Clamp zoom level between 1x and 10x
- ⬜ **Task 3.1.14:** Re-render timeline when zoom changes
- ⬜ **Task 3.1.15:** Add horizontal scrollbar for timeline overflow

**Acceptance:** Timeline canvas renders with time ruler, playhead is visible and draggable, zoom controls adjust timeline scale, can scroll horizontally. ⬜

---

### **Epic 3.2: Timeline State Management** ⬜

**Story:** Create Zustand store for timeline data and playhead synchronization

- ⬜ **Task 3.2.1:** Create `src/renderer/stores/timelineStore.ts`
- ⬜ **Task 3.2.2:** Define TimelineClip interface in `src/types/timeline.ts`
- ⬜ **Task 3.2.3:** Define state: `{ clips: TimelineClip[], playheadPosition: number, zoomLevel: number, selectedClipId: string | null }`
- ⬜ **Task 3.2.4:** Implement `addClipToTimeline(clip)` action
- ⬜ **Task 3.2.5:** Implement `removeClipFromTimeline(clipId)` action
- ⬜ **Task 3.2.6:** Implement `updateClip(clipId, updates)` action
- ⬜ **Task 3.2.7:** Implement `setPlayheadPosition(time)` action
- ⬜ **Task 3.2.8:** Implement `setZoomLevel(level)` action
- ⬜ **Task 3.2.9:** Implement `selectTimelineClip(clipId)` action
- ⬜ **Task 3.2.10:** Connect Timeline component to timelineStore
- ⬜ **Task 3.2.11:** Sync playhead canvas position with store playheadPosition
- ⬜ **Task 3.2.12:** Update store when playhead dragged on canvas
- ⬜ **Task 3.2.13:** Test adding/removing clips updates state correctly

**Acceptance:** Timeline state managed by Zustand, playhead position syncs between canvas and state, zoom level persists, can add/remove clips programmatically. ⬜

---

### **Epic 3.3: Drag & Drop to Timeline** ⬜

**Story:** Enable dragging clips from media library onto timeline tracks

- ⬜ **Task 3.3.1:** Make media library clip items draggable (HTML5 drag API)
- ⬜ **Task 3.3.2:** Set draggable data with clip ID and metadata
- ⬜ **Task 3.3.3:** Add drop zone to timeline canvas area
- ⬜ **Task 3.3.4:** Handle `drop` event on timeline to get clip data
- ⬜ **Task 3.3.5:** Calculate drop position (time) based on X coordinate and zoom
- ⬜ **Task 3.3.6:** Create TimelineClip object with startTime, endTime, trackId
- ⬜ **Task 3.3.7:** Add clip to timeline store via `addClipToTimeline()`
- ⬜ **Task 3.3.8:** Render timeline clips as colored rectangles on Konva canvas
- ⬜ **Task 3.3.9:** Calculate clip width based on duration and zoom level
- ⬜ **Task 3.3.10:** Display clip name/label inside rectangle
- ⬜ **Task 3.3.11:** Implement click to select clip (highlight with border)
- ⬜ **Task 3.3.12:** Update selectedClipId in store on click
- ⬜ **Task 3.3.13:** Make timeline clips draggable on canvas (reposition)
- ⬜ **Task 3.3.14:** Update clip startTime/endTime when repositioned
- ⬜ **Task 3.3.15:** Add visual feedback (color change) for selected clip

**Acceptance:** Can drag clip from media library onto timeline, clip appears as rectangle at drop position, can select clip by clicking, can reposition clips on timeline. ⬜

---

### **Epic 3.4: Timeline Playback Sync** ⬜

**Story:** Synchronize timeline playhead with video preview player during playback

- ⬜ **Task 3.4.1:** Create playback state in timeline store: `{ isPlaying: boolean, currentTime: number }`
- ⬜ **Task 3.4.2:** Implement `play()` and `pause()` actions in timeline store
- ⬜ **Task 3.4.3:** Add play/pause button to main UI (space bar icon)
- ⬜ **Task 3.4.4:** Connect play/pause button to timeline store actions
- ⬜ **Task 3.4.5:** Update playhead position on each animation frame during playback
- ⬜ **Task 3.4.6:** Use `requestAnimationFrame()` loop to increment currentTime
- ⬜ **Task 3.4.7:** Determine which clip is at current playhead position
- ⬜ **Task 3.4.8:** Update VideoPlayer src to active clip at playhead
- ⬜ **Task 3.4.9:** Sync video player's currentTime with playhead position within clip
- ⬜ **Task 3.4.10:** Play video when playhead enters clip boundaries
- ⬜ **Task 3.4.11:** Pause video when playhead exits clip
- ⬜ **Task 3.4.12:** Implement scrubbing: drag playhead to seek video
- ⬜ **Task 3.4.13:** Update video player currentTime when playhead manually moved
- ⬜ **Task 3.4.14:** Stop playback automatically at timeline end
- ⬜ **Task 3.4.15:** Handle gaps between clips (pause or show black frame)

**Acceptance:** Pressing play advances playhead smoothly, video preview plays in sync with playhead position, scrubbing playhead seeks video, playback stops at end. ⬜

---

## **PHASE 4: BASIC EDITING (MVP)** ⬜

### **Epic 4.1: Trim Functionality** ⬜

**Story:** Allow users to trim clips by dragging edge handles on the timeline

- ⬜ **Task 4.1.1:** Add trim handles (small rectangles) on left and right edges of timeline clips
- ⬜ **Task 4.1.2:** Make trim handles draggable horizontally
- ⬜ **Task 4.1.3:** Detect which handle is being dragged (left = trim start, right = trim end)
- ⬜ **Task 4.1.4:** Calculate new trimStart time based on left handle position
- ⬜ **Task 4.1.5:** Calculate new trimEnd time based on right handle position
- ⬜ **Task 4.1.6:** Update clip's trimStart/trimEnd in timeline store
- ⬜ **Task 4.1.7:** Constrain trim values to [0, clip.duration]
- ⬜ **Task 4.1.8:** Update clip visual width based on trimmed duration
- ⬜ **Task 4.1.9:** Add `trimStart` and `trimEnd` to TimelineClip interface
- ⬜ **Task 4.1.10:** Pass trim info to video player for preview
- ⬜ **Task 4.1.11:** Clamp video player currentTime to trimmed range
- ⬜ **Task 4.1.12:** Show trim values as tooltip during drag
- ⬜ **Task 4.1.13:** Test trimming updates preview correctly

**Acceptance:** Dragging clip edges trims video non-destructively, preview player respects trim start/end points, trim values constrained to valid range. ⬜

---

### **Epic 4.2: Split Clips** ⬜

**Story:** Enable splitting clips at playhead position into two separate clips

- ⬜ **Task 4.2.1:** Add "Split" button to timeline toolbar
- ⬜ **Task 4.2.2:** Enable split button only when playhead is over a clip
- ⬜ **Task 4.2.3:** Implement `splitClip(clipId, splitTime)` action in timeline store
- ⬜ **Task 4.2.4:** Find clip at current playhead position
- ⬜ **Task 4.2.5:** Calculate split point relative to clip start
- ⬜ **Task 4.2.6:** Create first clip: original start to split point
- ⬜ **Task 4.2.7:** Create second clip: split point to original end
- ⬜ **Task 4.2.8:** Preserve trim values in both new clips
- ⬜ **Task 4.2.9:** Generate unique IDs for new clips
- ⬜ **Task 4.2.10:** Remove original clip and add two new clips to timeline
- ⬜ **Task 4.2.11:** Update canvas to render both clips
- ⬜ **Task 4.2.12:** Test split at various playhead positions
- ⬜ **Task 4.2.13:** Test split on already-trimmed clip

**Acceptance:** Clicking split button divides clip at playhead into two clips, both clips maintain correct timing and trim values, timeline updates visually. ⬜

---

### **Epic 4.3: Delete Clips** ⬜

**Story:** Allow users to delete selected clips from timeline using keyboard

- ⬜ **Task 4.3.1:** Add keyboard event listener to Timeline component
- ⬜ **Task 4.3.2:** Listen for Delete and Backspace key presses
- ⬜ **Task 4.3.3:** Check if a clip is currently selected (selectedClipId !== null)
- ⬜ **Task 4.3.4:** Call `removeClipFromTimeline(selectedClipId)` on delete key
- ⬜ **Task 4.3.5:** Clear selectedClipId after deletion
- ⬜ **Task 4.3.6:** Remove clip rectangle from Konva canvas
- ⬜ **Task 4.3.7:** Add "Delete" button to timeline toolbar as alternative to keyboard
- ⬜ **Task 4.3.8:** Disable delete button when no clip selected
- ⬜ **Task 4.3.9:** Show confirmation prompt for deletion (optional, can skip for MVP)
- ⬜ **Task 4.3.10:** Test deletion updates timeline state and UI correctly

**Acceptance:** Selecting clip and pressing Delete/Backspace removes it from timeline, timeline state updates, canvas re-renders without clip. ⬜

---

### **Epic 4.4: Multi-Track Support** ⬜

**Story:** Add support for multiple timeline tracks (main video + overlay/PiP)

- ⬜ **Task 4.4.1:** Add `trackId` property to TimelineClip interface
- ⬜ **Task 4.4.2:** Define track layout constants (Track 1: y=0, Track 2: y=100, etc.)
- ⬜ **Task 4.4.3:** Render Track 1 lane on canvas (main video track)
- ⬜ **Task 4.4.4:** Render Track 2 lane on canvas (overlay/PiP track)
- ⬜ **Task 4.4.5:** Add track labels ("Track 1", "Track 2") on left side
- ⬜ **Task 4.4.6:** Calculate which track a clip is dropped on based on Y coordinate
- ⬜ **Task 4.4.7:** Assign trackId when adding clip to timeline
- ⬜ **Task 4.4.8:** Render clips on appropriate track based on trackId
- ⬜ **Task 4.4.9:** Allow moving clips between tracks via drag
- ⬜ **Task 4.4.10:** Update trackId when clip dragged to different track
- ⬜ **Task 4.4.11:** Constrain clip Y position to track boundaries
- ⬜ **Task 4.4.12:** Test clips on different tracks don't interfere with each other

**Acceptance:** Timeline shows two distinct track lanes, clips can be placed on Track 1 or Track 2, can drag clips between tracks, each track renders independently. ⬜

---

## **PHASE 5: EXPORT SYSTEM (MVP)** ⬜

### **Epic 5.1: FFmpeg Export Pipeline** ⬜

**Story:** Implement basic video export for single clip using FFmpeg

- ⬜ **Task 5.1.1:** Create "Export" button in main UI
- ⬜ **Task 5.1.2:** Create IPC handler `start-export` in main process
- ⬜ **Task 5.1.3:** Implement file save dialog for output path (dialog.showSaveDialog)
- ⬜ **Task 5.1.4:** Set default filename and filter to `.mp4`
- ⬜ **Task 5.1.5:** Create `src/main/services/export.ts` module
- ⬜ **Task 5.1.6:** Build basic FFmpeg command for single clip export
- ⬜ **Task 5.1.7:** Use fluent-ffmpeg to encode clip to MP4 (H.264 codec)
- ⬜ **Task 5.1.8:** Set audio codec to AAC
- ⬜ **Task 5.1.9:** Run FFmpeg command and save to output path
- ⬜ **Task 5.1.10:** Return success/error status to renderer
- ⬜ **Task 5.1.11:** Show success notification when export completes
- ⬜ **Task 5.1.12:** Test exported MP4 plays in VLC or QuickTime
- ⬜ **Task 5.1.13:** Handle FFmpeg errors gracefully (show error message)

**Acceptance:** Can export single timeline clip to MP4, file saves to chosen location, video plays correctly in external media player. ⬜

---

### **Epic 5.2: Multi-Clip Concatenation** ⬜

**Story:** Export timeline with multiple clips using FFmpeg filter_complex

- ⬜ **Task 5.2.1:** Pass entire timeline clips array to export IPC handler
- ⬜ **Task 5.2.2:** Sort timeline clips by startTime
- ⬜ **Task 5.2.3:** Build FFmpeg input list (add each unique video file as input)
- ⬜ **Task 5.2.4:** Implement trim filter for each clip based on trimStart/trimEnd
- ⬜ **Task 5.2.5:** Use `setpts` filter to reset timestamps after trim
- ⬜ **Task 5.2.6:** Build concat filter to stitch trimmed clips in sequence
- ⬜ **Task 5.2.7:** Handle gaps between clips (insert black frames or skip)
- ⬜ **Task 5.2.8:** Construct complete filter_complex string
- ⬜ **Task 5.2.9:** Execute FFmpeg command with filter_complex
- ⬜ **Task 5.2.10:** Test export with 2 clips from different source files
- ⬜ **Task 5.2.11:** Test export with 3+ clips in sequence
- ⬜ **Task 5.2.12:** Verify exported video has correct duration and clip order

**Acceptance:** Can export timeline with multiple clips, clips concatenate in correct order, trims are applied, final video plays seamlessly. ⬜

---

### **Epic 5.3: Export Progress & UI** ⬜

**Story:** Show real-time export progress with ability to cancel

- ⬜ **Task 5.3.1:** Create `ExportModal` component in `src/renderer/components/`
- ⬜ **Task 5.3.2:** Show modal when export starts
- ⬜ **Task 5.3.3:** Add progress bar (0-100%) to modal
- ⬜ **Task 5.3.4:** Add status text ("Encoding...", "Complete", etc.)
- ⬜ **Task 5.3.5:** Add cancel button to modal
- ⬜ **Task 5.3.6:** Listen to FFmpeg progress events in main process
- ⬜ **Task 5.3.7:** Calculate percentage from FFmpeg time progress / total duration
- ⬜ **Task 5.3.8:** Send progress updates via IPC (`export-progress` channel)
- ⬜ **Task 5.3.9:** Update modal progress bar on each progress event
- ⬜ **Task 5.3.10:** Estimate time remaining based on progress rate
- ⬜ **Task 5.3.11:** Display time remaining in modal (e.g., "2 minutes left")
- ⬜ **Task 5.3.12:** Implement cancel IPC handler that kills FFmpeg process
- ⬜ **Task 5.3.13:** Delete partial output file on cancel
- ⬜ **Task 5.3.14:** Close modal on completion or cancel
- ⬜ **Task 5.3.15:** Test progress updates smoothly during export

**Acceptance:** Export modal shows during encoding, progress bar updates in real-time, displays time remaining, cancel button stops export and cleans up. ⬜

---

### **Epic 5.4: Resolution Options** ⬜

**Story:** Allow users to choose export resolution (720p, 1080p, or source)

- ⬜ **Task 5.4.1:** Add resolution dropdown to export UI (before starting export)
- ⬜ **Task 5.4.2:** Options: "720p (1280x720)", "1080p (1920x1080)", "Source Resolution"
- ⬜ **Task 5.4.3:** Pass selected resolution to export IPC handler
- ⬜ **Task 5.4.4:** Determine output dimensions based on selection
- ⬜ **Task 5.4.5:** Add FFmpeg scale filter when resolution differs from source
- ⬜ **Task 5.4.6:** Use `scale=1280:720` or `scale=1920:1080` filter
- ⬜ **Task 5.4.7:** Maintain aspect ratio during scaling (use `scale=-2:720` if needed)
- ⬜ **Task 5.4.8:** Handle source resolution option (no scaling)
- ⬜ **Task 5.4.9:** Handle mixed-resolution clips (scale all to target resolution)
- ⬜ **Task 5.4.10:** Test export at 720p produces correct dimensions
- ⬜ **Task 5.4.11:** Test export at 1080p produces correct dimensions
- ⬜ **Task 5.4.12:** Test source resolution preserves original quality

**Acceptance:** Can select export resolution, exported videos have correct dimensions, scaling maintains aspect ratio, mixed-resolution timelines export correctly. ⬜

---

## **PHASE 6: PACKAGING (MVP Checkpoint)** ⬜

### **Epic 6.1: Electron Forge Configuration** ⬜

**Story:** Configure Electron Forge for building distributable applications

- ⬜ **Task 6.1.1:** Review and update `forge.config.js` for packaging
- ⬜ **Task 6.1.2:** Set app name to "ClipForge" in config
- ⬜ **Task 6.1.3:** Set version to "1.0.0" in package.json
- ⬜ **Task 6.1.4:** Add app icon files (icon.icns for Mac, icon.ico for Windows)
- ⬜ **Task 6.1.5:** Configure icon paths in forge.config.js
- ⬜ **Task 6.1.6:** Set up makers for target platforms (DMG for macOS, Squirrel for Windows)
- ⬜ **Task 6.1.7:** Configure bundle identifier (e.g., com.clipforge.app)
- ⬜ **Task 6.1.8:** Test `npm run package` command (creates executable)
- ⬜ **Task 6.1.9:** Test `npm run make` command (creates installer)
- ⬜ **Task 6.1.10:** Verify packaged app launches without terminal
- ⬜ **Task 6.1.11:** Check packaged app size (should be <200MB for macOS)
- ⬜ **Task 6.1.12:** Test FFmpeg binary is included in package
- ⬜ **Task 6.1.13:** Update README with build instructions

**Acceptance:** `npm run make` successfully creates distributable, packaged app launches independently, FFmpeg works in packaged version, file size reasonable. ⬜

---

### **Epic 6.2: MVP Testing Checklist** ⬜

**Story:** Comprehensive testing of all MVP features in packaged application

- ⬜ **Task 6.2.1:** Test import via "Import Video" button in packaged app
- ⬜ **Task 6.2.2:** Test import via drag-and-drop in packaged app
- ⬜ **Task 6.2.3:** Verify thumbnails generate correctly
- ⬜ **Task 6.2.4:** Verify video metadata displays correctly
- ⬜ **Task 6.2.5:** Test video preview playback (play/pause/seek)
- ⬜ **Task 6.2.6:** Test dragging clips onto timeline
- ⬜ **Task 6.2.7:** Test timeline playhead movement during playback
- ⬜ **Task 6.2.8:** Test scrubbing playhead to seek video
- ⬜ **Task 6.2.9:** Test trimming clips by dragging edge handles
- ⬜ **Task 6.2.10:** Test splitting clips at playhead position
- ⬜ **Task 6.2.11:** Test deleting clips with Delete key
- ⬜ **Task 6.2.12:** Test multi-track placement (Track 1 and Track 2)
- ⬜ **Task 6.2.13:** Test zoom controls on timeline
- ⬜ **Task 6.2.14:** Test export single clip to MP4
- ⬜ **Task 6.2.15:** Test export timeline with 3+ clips
- ⬜ **Task 6.2.16:** Test export progress bar updates
- ⬜ **Task 6.2.17:** Test export cancel functionality
- ⬜ **Task 6.2.18:** Test different resolution exports (720p, 1080p, source)
- ⬜ **Task 6.2.19:** Verify exported MP4 plays in VLC
- ⬜ **Task 6.2.20:** Test media library persistence (restart app, clips still there)
- ⬜ **Task 6.2.21:** Run app for 10+ minutes to check for memory leaks
- ⬜ **Task 6.2.22:** Document any bugs or issues found

**Acceptance:** All MVP features work correctly in packaged app, no critical bugs, app is stable during extended use, ready for submission. ✅ MVP COMPLETE

---

## **PHASE 7: RECORDING FEATURES (Post-MVP)** ⬜

### **Epic 7.1: Screen Recording** ⬜

**Story:** Enable users to record their screen using Electron desktopCapturer

- ⬜ **Task 7.1.1:** Create IPC handler `get-screen-sources` using desktopCapturer.getSources()
- ⬜ **Task 7.1.2:** Fetch available screen and window sources
- ⬜ **Task 7.1.3:** Return source list (id, name, thumbnail) to renderer
- ⬜ **Task 7.1.4:** Create `ScreenRecorder` component in renderer
- ⬜ **Task 7.1.5:** Display source selection UI (list of screens/windows)
- ⬜ **Task 7.1.6:** Get user selection and source ID
- ⬜ **Task 7.1.7:** Use getUserMedia with chromeMediaSourceId constraint
- ⬜ **Task 7.1.8:** Create MediaRecorder instance with screen stream
- ⬜ **Task 7.1.9:** Set video codec to VP8 or H.264
- ⬜ **Task 7.1.10:** Implement start recording (MediaRecorder.start())
- ⬜ **Task 7.1.11:** Collect video chunks during recording
- ⬜ **Task 7.1.12:** Implement stop recording (MediaRecorder.stop())
- ⬜ **Task 7.1.13:** Create Blob from recorded chunks
- ⬜ **Task 7.1.14:** Save recording to userData/recordings/ directory
- ⬜ **Task 7.1.15:** Generate unique filename with timestamp
- ⬜ **Task 7.1.16:** Add recorded file to media library automatically
- ⬜ **Task 7.1.17:** Test screen recording saves and plays back correctly

**Acceptance:** Can select screen or window, start/stop recording, recording saves to file, appears in media library, plays in preview player. ⬜

---

### **Epic 7.2: Webcam Recording** ⬜

**Story:** Enable webcam recording using getUserMedia

- ⬜ **Task 7.2.1:** Create `WebcamRecorder` component
- ⬜ **Task 7.2.2:** Use getUserMedia to request video from webcam
- ⬜ **Task 7.2.3:** Request audio from microphone simultaneously
- ⬜ **Task 7.2.4:** Display live webcam preview in UI
- ⬜ **Task 7.2.5:** Add device selection dropdown (if multiple cameras)
- ⬜ **Task 7.2.6:** Create MediaRecorder for webcam stream
- ⬜ **Task 7.2.7:** Implement start/stop recording
- ⬜ **Task 7.2.8:** Save webcam recording to userData/recordings/
- ⬜ **Task 7.2.9:** Auto-add to media library
- ⬜ **Task 7.2.10:** Handle permission denied errors (show instructions)
- ⬜ **Task 7.2.11:** Test webcam recording with audio

**Acceptance:** Can record webcam with audio, see live preview, save recording, file appears in media library. ⬜

---

### **Epic 7.3: Simultaneous Recording (PiP)** ⬜

**Story:** Record screen and webcam simultaneously in picture-in-picture layout

- ⬜ **Task 7.3.1:** Create combined recording mode in UI (checkbox or toggle)
- ⬜ **Task 7.3.2:** Get both screen stream and webcam stream
- ⬜ **Task 7.3.3:** Create canvas element for compositing streams
- ⬜ **Task 7.3.4:** Draw screen stream as full canvas background
- ⬜ **Task 7.3.5:** Draw webcam stream as smaller overlay (bottom-right corner)
- ⬜ **Task 7.3.6:** Set webcam overlay size (e.g., 320x240)
- ⬜ **Task 7.3.7:** Use canvas.captureStream() to get composite stream
- ⬜ **Task 7.3.8:** Add microphone audio track to composite stream
- ⬜ **Task 7.3.9:** Create MediaRecorder from composite stream
- ⬜ **Task 7.3.10:** Record composite stream to file
- ⬜ **Task 7.3.11:** Test PiP recording shows both screen and webcam
- ⬜ **Task 7.3.12:** Adjust webcam position/size options (stretch goal)

**Acceptance:** Can record screen with webcam overlay, both video streams visible in recording, audio captured from microphone. ⬜

---

### **Epic 7.4: Audio Capture** ⬜

**Story:** Ensure all recordings capture microphone audio with video

- ⬜ **Task 7.4.1:** Request audio track in getUserMedia calls
- ⬜ **Task 7.4.2:** Test audio is included in screen recordings
- ⬜ **Task 7.4.3:** Test audio is included in webcam recordings
- ⬜ **Task 7.4.4:** Test audio is included in PiP recordings
- ⬜ **Task 7.4.5:** Add microphone device selection dropdown
- ⬜ **Task 7.4.6:** Implement audio level meter during recording
- ⬜ **Task 7.4.7:** Show visual feedback when audio is being captured
- ⬜ **Task 7.4.8:** Handle no microphone detected (allow video-only)
- ⬜ **Task 7.4.9:** Test audio sync with video in recordings

**Acceptance:** All recording types capture audio from microphone, audio plays back in sync with video, can select audio input device. ⬜

---

### **Epic 7.5: Recording UI & Controls** ⬜

**Story:** Create intuitive recording interface with start/stop/pause controls

- ⬜ **Task 7.5.1:** Create `RecordingPanel` component with all recording options
- ⬜ **Task 7.5.2:** Add radio buttons for recording type (Screen, Webcam, Both)
- ⬜ **Task 7.5.3:** Add Start Recording button (large, prominent)
- ⬜ **Task 7.5.4:** Disable source selection during recording
- ⬜ **Task 7.5.5:** Show recording timer (MM:SS) during active recording
- ⬜ **Task 7.5.6:** Add Stop Recording button (replaces Start when recording)
- ⬜ **Task 7.5.7:** Add Pause/Resume button (optional for MVP)
- ⬜ **Task 7.5.8:** Show recording indicator (red dot or pulsing circle)
- ⬜ **Task 7.5.9:** Display live preview of what's being recorded
- ⬜ **Task 7.5.10:** Show notification when recording starts
- ⬜ **Task 7.5.11:** Show notification when recording saved
- ⬜ **Task 7.5.12:** Auto-scroll to new recording in media library
- ⬜ **Task 7.5.13:** Test complete recording workflow (select → record → stop → appears in library)

**Acceptance:** Recording UI is intuitive and clear, shows recording status, timer updates during recording, finished recordings auto-appear in media library. ⬜

---

## **PHASE 8: POLISH & ADVANCED FEATURES** ⬜

### **Epic 8.1: Keyboard Shortcuts** ⬜

**Story:** Implement keyboard shortcuts for common editing actions

- ⬜ **Task 8.1.1:** Create keyboard event listener at app level
- ⬜ **Task 8.1.2:** Implement Space bar for play/pause toggle
- ⬜ **Task 8.1.3:** Implement Delete/Backspace for removing selected clip
- ⬜ **Task 8.1.4:** Implement Cmd/Ctrl+S for save project
- ⬜ **Task 8.1.5:** Implement Cmd/Ctrl+E for export
- ⬜ **Task 8.1.6:** Implement Cmd/Ctrl+Z for undo (requires undo stack)
- ⬜ **Task 8.1.7:** Implement Cmd/Ctrl+Shift+Z for redo (requires redo stack)
- ⬜ **Task 8.1.8:** Implement arrow keys for frame-by-frame scrubbing
- ⬜ **Task 8.1.9:** Implement Home/End for jump to timeline start/end
- ⬜ **Task 8.1.10:** Add keyboard shortcuts help modal (Cmd/Ctrl+?)
- ⬜ **Task 8.1.11:** Display shortcuts in tooltips on buttons
- ⬜ **Task 8.1.12:** Test all shortcuts work as expected

**Acceptance:** All keyboard shortcuts functional, shortcuts listed in help modal, power users can edit without mouse. ⬜

---

### **Epic 8.2: Timeline Enhancements** ⬜

**Story:** Add snap-to-grid and scroll for improved timeline editing

- ⬜ **Task 8.2.1:** Implement snap-to-grid when dragging clips
- ⬜ **Task 8.2.2:** Add grid interval option (1s, 5s, 10s)
- ⬜ **Task 8.2.3:** Snap clip edges to grid lines during drag
- ⬜ **Task 8.2.4:** Implement snap-to-clip edges (magnetic snapping)
- ⬜ **Task 8.2.5:** Detect when clip edge is within snap threshold of another clip
- ⬜ **Task 8.2.6:** Auto-align clips when close to adjacent clip edges
- ⬜ **Task 8.2.7:** Add snap toggle button (enable/disable snapping)
- ⬜ **Task 8.2.8:** Implement horizontal scroll for long timelines
- ⬜ **Task 8.2.9:** Add scrollbar below timeline canvas
- ⬜ **Task 8.2.10:** Sync canvas offset with scroll position
- ⬜ **Task 8.2.11:** Auto-scroll timeline when playhead reaches edge
- ⬜ **Task 8.2.12:** Test snapping with various clip arrangements

**Acceptance:** Clips snap to grid lines and other clip edges when enabled, timeline scrolls for long compositions, auto-scrolls during playback. ⬜

---

### **Epic 8.3: Error Handling & Validation** ⬜

**Story:** Improve error handling with user-friendly messages and validation

- ⬜ **Task 8.3.1:** Create toast notification component for errors/success
- ⬜ **Task 8.3.2:** Show toast when file import fails
- ⬜ **Task 8.3.3:** Validate file format on import (reject non-video files)
- ⬜ **Task 8.3.4:** Show specific error for unsupported formats
- ⬜ **Task 8.3.5:** Handle corrupted video files gracefully (catch FFmpeg errors)
- ⬜ **Task 8.3.6:** Check available disk space before starting recording
- ⬜ **Task 8.3.7:** Warn if disk space < 1GB before export
- ⬜ **Task 8.3.8:** Show error if export fails with FFmpeg log details
- ⬜ **Task 8.3.9:** Validate timeline before export (warn if empty)
- ⬜ **Task 8.3.10:** Handle missing source files (file moved/deleted)
- ⬜ **Task 8.3.11:** Show clear error if FFmpeg binary not found
- ⬜ **Task 8.3.12:** Test error handling for various failure scenarios

**Acceptance:** All errors show user-friendly messages, validation prevents invalid operations, disk space checked before large operations. ⬜

---

### **Epic 8.4: Project Save/Load** ⬜

**Story:** Allow saving and loading timeline projects as JSON files

- ⬜ **Task 8.4.1:** Create "Save Project" menu item or button
- ⬜ **Task 8.4.2:** Create IPC handler for saving project
- ⬜ **Task 8.4.3:** Serialize timeline state to JSON (clips, zoom, etc.)
- ⬜ **Task 8.4.4:** Include media library references in project file
- ⬜ **Task 8.4.5:** Show save dialog for project file location (.clipforge extension)
- ⬜ **Task 8.4.6:** Write project JSON to selected file path
- ⬜ **Task 8.4.7:** Create "Open Project" menu item or button
- ⬜ **Task 8.4.8:** Create IPC handler for loading project
- ⬜ **Task 8.4.9:** Read and parse project JSON file
- ⬜ **Task 8.4.10:** Validate all referenced media files still exist
- ⬜ **Task 8.4.11:** Load timeline state into Zustand stores
- ⬜ **Task 8.4.12:** Load media library state
- ⬜ **Task 8.4.13:** Render loaded timeline on canvas
- ⬜ **Task 8.4.14:** Test save → close app → reopen → load project workflow

**Acceptance:** Can save project to .clipforge file, can load project and restore full timeline state, media files validated on load. ⬜

---

### **Epic 8.5: Final Polish** ⬜

**Story:** Add professional touches to improve overall user experience

- ⬜ **Task 8.5.1:** Create app icon (512x512 PNG) for macOS/Windows
- ⬜ **Task 8.5.2:** Add app icon to packaged builds
- ⬜ **Task 8.5.3:** Design splash screen for app launch (optional)
- ⬜ **Task 8.5.4:** Improve UI spacing and alignment with Tailwind
- ⬜ **Task 8.5.5:** Add consistent color scheme (primary, secondary, accent colors)
- ⬜ **Task 8.5.6:** Add loading spinners for async operations (import, export)
- ⬜ **Task 8.5.7:** Add tooltips to all buttons and controls
- ⬜ **Task 8.5.8:** Add hover states to interactive elements
- ⬜ **Task 8.5.9:** Improve timeline visual design (better colors, shadows)
- ⬜ **Task 8.5.10:** Add transition animations for modals and panels
- ⬜ **Task 8.5.11:** Create onboarding flow or welcome screen (optional)
- ⬜ **Task 8.5.12:** Add "About" dialog with app version and credits
- ⬜ **Task 8.5.13:** Final UI review and adjustments
- ⬜ **Task 8.5.14:** Create demo video (3-5 minutes) showing all features
- ⬜ **Task 8.5.15:** Update README with screenshots and feature list

**Acceptance:** App looks professional and polished, consistent visual design, loading states for all async operations, tooltips everywhere, demo video ready. ✅ FINAL SUBMISSION READY

---

## **SUBMISSION CHECKLIST** ⬜

### **Final Deliverables**

- ⬜ **GitHub Repository:** Code pushed with clear commit history
- ⬜ **README.md:** Setup instructions, architecture overview, build instructions
- ⬜ **Packaged App:** DMG (macOS) or installer (Windows) built and tested
- ⬜ **Demo Video:** 3-5 minute video showing record → import → edit → export workflow
- ⬜ **GitHub Release:** v1.0.0 tagged with binaries uploaded
- ⬜ **Architecture Documentation:** Brief overview of main/renderer process structure
- ⬜ **Known Issues:** Document any bugs or limitations
- ⬜ **Submission Form:** Complete and submit before Wednesday, October 29th at 10:59 PM CT

**Final Test:** Record screen, import 3 clips, arrange on timeline, trim/split, add overlay on Track 2, export to 1080p MP4, verify plays perfectly. ✅ SHIP IT!

---

**Legend:**
- ✅ **Done** — Task completed and tested
- 🟦 **In Progress** — Currently working on this task
- ⬜ **Not Started** — Not yet begun
- ❌ **Blocked** — Cannot proceed due to dependency or issue

