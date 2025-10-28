# ClipForge

<div align="center">
  
**A powerful desktop video editor for recording, editing, and exporting high-quality videos**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/clipforge)
[![Electron](https://img.shields.io/badge/Electron-39.0.0-47848F.svg)](https://www.electronjs.org/)

</div>

---

## 🎥 About ClipForge

ClipForge is a native desktop video editor inspired by CapCut, designed to make professional video editing accessible and intuitive. Import video clips, arrange them on a visual timeline, trim and split content, add multi-track overlays, and export high-quality MP4 videos — all within a single desktop application.

### ✨ Key Features

- 📂 **Video Import**: Drag-and-drop or file picker support for MP4, MOV, and WebM files
- 🎬 **Visual Timeline**: Canvas-based timeline with precise clip arrangement and playback
- ✂️ **Advanced Editing**: Trim clips, split at playhead, multi-track support (main video + overlays)
- ▶️ **Real-time Preview**: Synchronized video playback with timeline scrubbing
- 📤 **High-Quality Export**: Export to MP4 with H.264/AAC codec at 720p, 1080p, or source resolution
- 💾 **Persistent Library**: Media library automatically saves and reloads your clips
- 🎯 **Intuitive UI**: Modern interface built with React and TailwindCSS

---

## 🚀 Quick Start

### Prerequisites

Before running ClipForge, ensure you have:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** (for cloning the repository)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/clipforge.git
cd clipforge
```

2. **Install dependencies**
```bash
npm install
```

3. **Start the development app**
```bash
npm start
```

The app will launch in development mode with DevTools open.

---

## 📦 Building & Packaging

### Development Mode

Run the app in development mode with hot-reload:

```bash
npm start
```

### Create a Packaged Executable

To create a native application (without installer):

```bash
npm run package
```

**Output Location:**
- **macOS**: `out/ClipForge-darwin-arm64/ClipForge.app`
- **Windows**: `out/ClipForge-win32-x64/ClipForge.exe`
- **Linux**: `out/ClipForge-linux-x64/ClipForge`

The packaged app is a standalone executable you can run directly.

### Create an Installer/DMG

To build a distributable installer:

```bash
npm run make
```

**Output Location:**
- **macOS**: `out/make/ClipForge-1.0.0-arm64.dmg` (DMG disk image)
- **Windows**: `out/make/squirrel.windows/x64/` (Squirrel installer)
- **Linux**: `out/make/` (DEB and RPM packages)

**What gets packaged:**
- The entire Electron app bundled into a single executable
- FFmpeg and FFprobe binaries (for video processing)
- All dependencies and assets
- App size: ~150MB for macOS, ~200MB for Windows

### Installing the DMG (macOS)

1. Locate the DMG file: `out/make/ClipForge-1.0.0-arm64.dmg`
2. Double-click to mount the disk image
3. Drag `ClipForge.app` to your Applications folder
4. Launch ClipForge from Applications

---

## 📖 User Guide

### Getting Started

#### 1. Import Video Files

**Method A: File Picker**
- Click the **"Import Video"** button in the Media Library panel (left side)
- Select one or more video files (MP4, MOV, WebM)
- Files will appear in your media library with thumbnails

**Method B: Drag & Drop**
- Drag video files from your file system
- Drop them onto the Media Library panel
- Files are automatically imported and thumbnails generated

**What happens on import:**
- ClipForge extracts video metadata (duration, resolution, file size)
- Generates a thumbnail preview at 1 second
- Adds the clip to your persistent media library
- Files remain in their original location (non-destructive editing)

---

#### 2. Build Your Timeline

**Adding Clips to Timeline:**
1. Find your clip in the Media Library
2. Drag the clip thumbnail onto the Timeline canvas (bottom panel)
3. Drop it where you want it to appear in your video
4. The clip appears as a colored rectangle showing its duration

**Timeline Features:**
- **Playhead** (red vertical line): Shows current playback position
- **Time Ruler**: Shows timestamps (00:00, 00:10, 00:20, etc.)
- **Track 1** (Main Video): Primary video track
- **Track 2** (Overlay): For picture-in-picture or overlay videos
- **Zoom Controls** (+/- buttons): Adjust timeline scale for precision

**Multi-Track Support:**
- Drag clips to different vertical positions to place them on Track 1 or Track 2
- Track 2 clips appear as overlays on top of Track 1 during playback
- Use Track 2 for picture-in-picture effects, watermarks, or B-roll overlays

---

#### 3. Edit Your Clips

**Trim Clips (Non-Destructive):**
1. Click a timeline clip to select it (it will highlight)
2. Drag the **left edge handle** to set the trim start point
3. Drag the **right edge handle** to set the trim end point
4. The original file is not modified — only playback range changes

**Split Clips:**
1. Move the playhead (red line) to where you want to split
2. Click the **"Split"** button in the timeline toolbar
3. The clip divides into two separate clips at the playhead position
4. Each clip can now be moved, trimmed, or deleted independently

**Delete Clips:**
1. Click a clip to select it
2. Press **Delete** or **Backspace** key
3. Or click the **"Delete"** button in the toolbar
4. The clip is removed from the timeline (original file remains safe)

**Reposition Clips:**
- Click and drag any clip left/right to change its timing
- Drag clips up/down to move between tracks
- Clips can overlap on different tracks but not on the same track

---

#### 4. Preview Your Video

**Playback Controls:**
- **Play/Pause Button**: Start or stop timeline playback
- **Spacebar**: Quick keyboard shortcut for play/pause
- **Progress Bar**: Shows current position within the active clip
- **Time Display**: Shows current playhead time in MM:SS format

**Video Player Panel:**
- Located in the top-right of the interface
- Displays the video at the current playhead position
- Automatically switches between clips as playhead moves
- Shows the active clip at each moment in the timeline

**Scrubbing:**
- Click and drag the playhead (red line) left/right
- Video preview updates in real-time as you scrub
- Use this to find precise edit points before splitting

**Zoom for Precision:**
- Click **+** to zoom in (shows more detail, larger timeline)
- Click **-** to zoom out (shows more of your project at once)
- Zooming helps make frame-accurate edits

---

#### 5. Export Your Video

**Starting an Export:**
1. Click the **"Export"** button (top toolbar)
2. The Export Modal appears with options:
   - **Resolution**: Choose 720p, 1080p, or Source (original)
   - **Output Path**: Click "Choose Location" to select where to save
3. Click **"Start Export"** to begin encoding

**Resolution Options:**
- **720p (1280×720)**: Smaller file size, good for web sharing
- **1080p (1920×1080)**: High quality, standard for YouTube/social media
- **Source Resolution**: Maintains original video quality (largest files)

**During Export:**
- A progress bar shows encoding progress (0-100%)
- Estimated time remaining is displayed
- You can **Cancel** the export at any time
- The app remains responsive during export

**After Export:**
- A success notification appears when encoding completes
- Your MP4 file is saved to the chosen location
- Output format: H.264 video codec + AAC audio codec
- The exported video plays in any media player (VLC, QuickTime, etc.)

**What gets exported:**
- All clips on the timeline, concatenated in order
- Trim points are applied (only visible portions of clips)
- Track 1 and Track 2 are composited together
- Gaps between clips appear as black frames
- Audio is included from all clips

---

### Advanced Tips

**Keyboard Shortcuts:**
- **Spacebar**: Play/Pause
- **Delete/Backspace**: Remove selected clip
- **Click timeline clip**: Select for editing

**Working with Multiple Clips:**
- Arrange clips in sequence to create a montage
- Leave small gaps for "breaths" between scenes
- Use Track 2 for overlays like logos or reactions
- Export clips trimmed from longer recordings for bite-sized content

**Performance Tips:**
- Imported videos stay in their original location (don't move or delete source files)
- Media library persists across app restarts
- Large 4K videos may take longer to export (FFmpeg processing is CPU-intensive)
- Close other heavy applications during export for best performance

**File Management:**
- ClipForge stores thumbnails in: `~/Library/Application Support/ClipForge/thumbnails/` (macOS)
- Media library data saved to: `~/Library/Application Support/ClipForge/` (macOS)
- Original video files are never modified — all editing is non-destructive

---

## 🏗️ Architecture Overview

### Tech Stack

- **Desktop Framework**: Electron 39.0.0
- **Frontend**: React 18.3.1 + TypeScript 5.4.5
- **UI Styling**: TailwindCSS 3.4.18
- **Timeline Rendering**: Konva.js 9.3.22 (canvas-based)
- **State Management**: Zustand 4.5.7
- **Video Processing**: FFmpeg (via ffmpeg-static 5.2.0 + fluent-ffmpeg 2.1.3)
- **Build System**: Electron Forge 7.10.2 (Webpack)
- **Persistence**: electron-store 8.2.0

### Project Structure

```
clipforge/
├── src/
│   ├── main/               # Electron main process (Node.js)
│   │   ├── index.ts        # App initialization & window creation
│   │   ├── ipc/            # IPC handlers (communication with renderer)
│   │   │   ├── handlers.ts
│   │   │   ├── import-handler.ts
│   │   │   ├── export-handler.ts
│   │   │   └── media-library-handler.ts
│   │   └── services/       # Business logic
│   │       ├── ffmpeg.ts   # Video metadata & thumbnail generation
│   │       └── export.ts   # Video export & encoding
│   ├── renderer/           # React frontend (browser context)
│   │   ├── components/     # UI components
│   │   │   ├── MediaLibrary.tsx
│   │   │   ├── VideoPlayer.tsx
│   │   │   ├── Timeline.tsx
│   │   │   └── ExportModal.tsx
│   │   ├── stores/         # Zustand state management
│   │   │   ├── mediaStore.ts
│   │   │   └── timelineStore.ts
│   │   ├── index.tsx       # React root
│   │   └── index.html      # HTML entry point
│   ├── preload/            # Preload scripts (IPC bridge)
│   │   └── preload.ts      # Exposes IPC to renderer via contextBridge
│   └── types/              # TypeScript type definitions
│       ├── ipc.ts
│       ├── media.ts
│       └── timeline.ts
├── forge.config.ts         # Electron Forge packaging config
├── webpack.*.config.ts     # Webpack build configuration
└── package.json            # Dependencies & scripts
```

### How It Works

**1. Main Process (Node.js)**
- Creates the app window using Electron's BrowserWindow
- Handles file system operations (import, save, export)
- Runs FFmpeg commands for video processing
- Manages IPC communication with renderer process

**2. Renderer Process (Browser)**
- Runs the React UI in a sandboxed browser context
- Displays media library, timeline, and video player
- Sends IPC messages to main process for file operations
- Uses Konva canvas for high-performance timeline rendering

**3. Preload Script (Bridge)**
- Safely exposes IPC methods to renderer via `contextBridge`
- Maintains security with `contextIsolation: true`
- Prevents direct Node.js access from browser code

**4. Video Processing Pipeline**
```
Import → FFprobe (metadata) → Thumbnail generation → Media Library
Timeline → Export command → FFmpeg (encode) → MP4 output
```

---

## 🛠️ Development

### Available Scripts

```bash
npm start          # Run app in development mode
npm run package    # Create packaged executable
npm run make       # Build distributable installer/DMG
npm run lint       # Run ESLint on TypeScript files
```

### Building for Different Platforms

**macOS (DMG):**
```bash
npm run make
# Output: out/make/ClipForge-1.0.0-arm64.dmg
```

**Windows (Squirrel Installer):**
```bash
npm run make
# Output: out/make/squirrel.windows/x64/
```

**Linux (DEB/RPM):**
```bash
npm run make
# Output: out/make/*.deb and *.rpm
```

### Configuration Files

- **`forge.config.ts`**: Electron Forge packaging settings
  - Configures asar packaging with FFmpeg binary unpacking
  - Sets bundle identifier for macOS (`com.clipforge.app`)
  - Defines makers for DMG, Squirrel, DEB, RPM

- **`webpack.*.config.ts`**: Build configuration for main and renderer
  - Compiles TypeScript to JavaScript
  - Bundles React and dependencies
  - Configures TailwindCSS processing

- **`tsconfig.json`**: TypeScript compiler settings
  - Strict mode enabled for type safety
  - Path aliases for clean imports

---

## 🐛 Troubleshooting

### App won't start after packaging

**Issue**: Packaged app crashes on launch

**Solution**:
- Ensure FFmpeg binaries are included in `extraResource` (see `forge.config.ts`)
- Check that native modules are unpacked from asar archive
- Run from terminal to see error logs: `./ClipForge.app/Contents/MacOS/ClipForge`

### Videos won't import

**Issue**: Drag-and-drop or import button fails

**Solution**:
- Verify file format is MP4, MOV, or WebM
- Check that FFmpeg binary is accessible (test with `npm start`)
- Ensure file isn't corrupted (try opening in VLC first)

### Export fails or produces corrupt files

**Issue**: Export hangs or output video doesn't play

**Solution**:
- Check available disk space (need ~2x source file size free)
- Verify FFmpeg is working: look for error messages in console
- Try exporting a single clip first to isolate the issue
- Ensure source files haven't been moved or deleted

### Timeline playback is choppy

**Issue**: Video stutters during preview

**Solution**:
- Large 4K files may require more processing power
- Close other applications to free up RAM
- Try zooming in on timeline for smoother rendering
- This is preview only — exports will be smooth

### Can't find exported video

**Issue**: Export completes but file isn't where expected

**Solution**:
- Check the path shown in the save dialog
- Default location is usually your user's `Movies` or `Videos` folder
- Search your system for `*.mp4` files created recently

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Yibin Long**
- Email: yibinlong@outlook.com
- GitHub: [@yourusername](https://github.com/yourusername)

---

## 🙏 Acknowledgments

- Inspired by CapCut's intuitive video editing interface
- Built with [Electron](https://www.electronjs.org/) and [React](https://reactjs.org/)
- Video processing powered by [FFmpeg](https://ffmpeg.org/)
- Timeline rendering by [Konva.js](https://konvajs.org/)

---

## 🚧 Known Limitations (v1.0.0)

- **Recording features** (screen capture, webcam) are planned for v2.0
- **Undo/Redo** functionality not yet implemented
- **Transitions** between clips (fade, dissolve) not available in v1.0
- **Audio-only tracks** not supported (videos must have video stream)
- **Large files** (>4K resolution) may have slower preview performance
- **Project save/load** (save timeline as file) planned for future release

---

## 🗺️ Roadmap

**Planned for v2.0:**
- [ ] Screen and webcam recording with audio
- [ ] Picture-in-picture recording mode
- [ ] Undo/Redo functionality
- [ ] Keyboard shortcut customization
- [ ] Project save/load (.clipforge files)
- [ ] Timeline snap-to-grid and magnetic snapping
- [ ] Basic transitions (fade, dissolve)
- [ ] Audio waveform visualization
- [ ] App icon and branding polish

---

<div align="center">

**Made with ❤️ for video creators**

[Report Bug](https://github.com/yourusername/clipforge/issues) · [Request Feature](https://github.com/yourusername/clipforge/issues)

</div>
