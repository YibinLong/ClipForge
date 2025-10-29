/**
 * MediaLibrary Component
 * 
 * WHY THIS COMPONENT EXISTS:
 * - Provides UI for importing video files into ClipForge
 * - Supports two import methods: file picker button and drag-and-drop
 * - Displays list of imported video files with thumbnails and metadata
 * 
 * FEATURES:
 * - "Import Video" button that opens native file dialog with FFmpeg processing
 * - Drag-and-drop zone with visual feedback (also processes through FFmpeg)
 * - File type validation (only .mp4, .mov, .webm)
 * - Rich display: thumbnails, duration, resolution, file size
 * 
 * UPDATED IN EPIC 2.2:
 * - Now displays MediaClip objects with full metadata (not just file paths)
 * - Shows thumbnail previews for each video
 * - Displays formatted metadata (duration as MM:SS, file size as MB)
 * - Drag-and-drop now processes files through IPC for metadata extraction
 * 
 * STATE:
 * - Local state for now (Epic 2.4 will migrate to Zustand store)
 * - Cumulative imports (each import/drop adds to existing list)
 */

import React, { useEffect, useState } from 'react';
import { isIPCError, ImportFileResponse, IPC_CHANNELS } from '../../types/ipc';
import { MediaClip } from '../../types/media';
import { useMediaStore } from '../stores/mediaStore';
import { generateCaptions, onGenerateCaptionsProgress, revealInFolder } from '../utils/ipc';
import RecordingPanel from './RecordingPanel';

interface MediaLibraryProps {
  onSelectClip?: (clip: MediaClip) => void;
  selectedClipId?: string | null;
}

/**
 * Format duration from seconds to MM:SS format
 * 
 * @param seconds - Duration in seconds (e.g., 125.5)
 * @returns Formatted string (e.g., "02:05")
 */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Format file size from bytes to MB
 * 
 * @param bytes - File size in bytes (e.g., 15728640)
 * @returns Formatted string (e.g., "15.00 MB")
 */
function formatFileSize(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(2)} MB`;
}

/**
 * Format resolution from width and height
 * 
 * @param width - Video width in pixels
 * @param height - Video height in pixels
 * @returns Formatted string (e.g., "1920x1080")
 */
function formatResolution(width: number, height: number): string {
  return `${width}x${height}`;
}

/**
 * Create a clean, short folder label like "…/Parent/Folder" with middle ellipsis if long.
 * Shows the last 1–2 folder segments and prefixes with … if there are more.
 */
function formatFolderDisplay(absolutePath: string): string {
  const parts = absolutePath.split(/\\|\//).filter(Boolean);
  if (parts.length <= 1) return '—';
  const folderParts = parts.slice(0, -1); // drop filename
  if (folderParts.length === 0) return '—';
  const lastTwo = folderParts.slice(-2).join('/');
  const base = folderParts.length > 2 ? `…/${lastTwo}` : lastTwo;
  // Middle-ellipsize if still long
  const MAX = 32;
  if (base.length <= MAX) return base;
  const head = base.slice(0, 16);
  const tail = base.slice(-14);
  return `${head}…${tail}`;
}

/**
 * MediaLibrary Component
 * 
 * Renders the media library UI with import functionality and rich metadata display
 */
const MediaLibrary: React.FC<MediaLibraryProps> = ({ onSelectClip, selectedClipId = null }) => {
  // Zustand media store bindings
  const clips = useMediaStore(state => state.clips);
  const addClips = useMediaStore(state => state.addClips);
  const removeClip = useMediaStore(state => state.removeClip);
  const clearAll = useMediaStore(state => state.clearAll);
  const selectClip = useMediaStore(state => state.selectClip);
  const initializeFromSaved = useMediaStore(state => state.initializeFromSaved);
  const storeSelectedClipId = useMediaStore(state => state.selectedClipId);
  const isInitializing = useMediaStore(state => state.isInitializing);
  
  // State to track drag-over state for visual feedback
  const [isDragOver, setIsDragOver] = useState(false);
  
  // State to track loading state during import
  const [isImporting, setIsImporting] = useState(false);

  // Unified recording panel
  const [showRecordingPanel, setShowRecordingPanel] = useState(false);

  // Captions generation state (track which clipIds are generating)
  const [generating, setGenerating] = useState<Set<string>>(new Set());

  // Subscribe to captions progress (optional logging/UI hooks)
  useEffect(() => {
    const unsub = onGenerateCaptionsProgress((_e) => {
      // Progress event received
    });
    return () => { 
      try { 
        if (unsub) unsub(); 
      } catch (err) {
        // Ignore unsubscribe errors
      }
    };
  }, []);

  // Optional: auto-scroll to latest item when clips change
  const listRef = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    try {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    } catch (err) {
      // Ignore scroll errors
    }
  }, [clips.length]);

  // Initialize persisted media library on first mount
  useEffect(() => {
    void initializeFromSaved();
  }, [initializeFromSaved]);

  /**
   * Handle "Import Video" button click
   * 
   * Opens native file dialog via IPC call to main process.
   * Main process extracts metadata and generates thumbnails using FFmpeg.
   * Adds complete MediaClip objects to the media library.
   * 
   * EPIC 2.2 UPDATE:
   * - Now receives MediaClip objects with metadata instead of just file paths
   * - FFmpeg processing happens in main process before returning
   */
  const handleImportClick = async () => {
    try {
      setIsImporting(true);
      const response = await window.electron.invoke(IPC_CHANNELS.IMPORT_FILE);

      if (isIPCError(response)) {
        console.error('[MEDIA LIBRARY] Import error:', response.error);
        alert(`Import failed: ${response.error}`);
        return;
      }

      const importResponse = response as ImportFileResponse;

      if (importResponse.clips.length > 0) {
        addClips(importResponse.clips);
      }
    } catch (error) {
      console.error('[MEDIA LIBRARY] Unexpected error during import:', error);
      alert('An unexpected error occurred during import');
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * Handle drag over event
   * 
   * Must call preventDefault() to allow drop
   * Updates visual feedback state
   */
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  /**
   * Handle drag enter event
   */
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  /**
   * Handle drag leave event
   * 
   * Resets visual feedback state ONLY when actually leaving the drop zone
   * 
   * BUG FIX: dragLeave fires when moving between parent and child elements
   * We check if relatedTarget (where mouse is going) is still inside the drop zone
   * Only clear the drag state if we're truly leaving the entire drop zone
   */
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if we're moving to a child element or actually leaving
    const relatedTarget = e.relatedTarget as Node;
    
    // If relatedTarget is NOT inside currentTarget, we're leaving the drop zone
    if (!e.currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  };

  /**
   * Handle file drop event
   * 
   * Extracts file paths from dropped files, validates extensions,
   * and sends to main process for FFmpeg processing (same as Import button).
   * 
   * EPIC 2.2 UPDATE:
   * - Now sends dropped files through IPC for metadata extraction
   * - Uses the same import-file handler as the Import button
   * - This ensures dropped files also get thumbnails and metadata
   * 
   * TECHNICAL NOTE:
   * - We can't directly process File objects in renderer
   * - We extract file.path (Electron-specific) and use Import button flow
   * - Alternative: Create separate IPC handler for dropped files, but reusing is simpler
   */
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const dt = e.dataTransfer;
    const droppedFiles = Array.from(dt.files);
    
    // Filter for valid video file extensions
    const validExtensions = ['.mp4', '.mov', '.webm'];
    const validFiles = droppedFiles.filter(file => {
      const fileName = file.name.toLowerCase();
      return validExtensions.some(ext => fileName.endsWith(ext));
    });

    if (validFiles.length === 0) {
      alert('Please drop valid video files (.mp4, .mov, .webm)');
      return;
    }

    // Extract file paths from File objects
    // 1) Prefer legacy Electron file.path when present
    let filePaths = validFiles
      .map(file => (file as unknown as { path?: string }).path)
      .filter((p): p is string => !!p);

    // 2) Fallback: use secure resolver exposed by preload (Electron webUtils)
    if (filePaths.length === 0 && typeof window !== 'undefined' && window.electron && 'getPathForFile' in window.electron) {
      try {
        const resolved = validFiles
          .map(file => window.electron.getPathForFile(file))
          .filter((p): p is string => !!p);
        if (resolved.length > 0) {
          filePaths = resolved;
        }
      } catch (resolverErr) {
        // Silently fail and try next method
      }
    }

    // 3) Last resort: parse file:// URIs from payload if available
    if (filePaths.length === 0) {
      const uriListRaw = dt.getData('text/uri-list');
      if (uriListRaw) {
        const uris = uriListRaw
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => !!line && !line.startsWith('#'));
        try {
          const fromUris = uris
            .filter((u) => u.toLowerCase().startsWith('file://'))
            .map((u) => decodeURI(u.replace('file://', '')));
          if (fromUris.length > 0) {
            filePaths = fromUris;
          }
        } catch (uriErr) {
          // Silently fail
        }
      }
    }
    
    if (filePaths.length === 0) {
      alert('Could not extract file paths. Please try using the Import button instead.');
      return;
    }
    
    // Process dropped files through the same workflow as Import button
    // This is a bit of a workaround since the import-file handler uses dialog.showOpenDialog
    // For now, we'll process each file path individually
    // In the future, we could create a separate IPC handler for processing file paths directly
    
    try {
      setIsImporting(true);

      const response = await window.electron.invoke(
        IPC_CHANNELS.IMPORT_FILE_PATHS,
        { paths: filePaths }
      );

      if (isIPCError(response)) {
        console.error('[MEDIA LIBRARY] DnD import error:', response.error, response.details);
        alert(`Import failed: ${response.error}`);
        return;
      }

      const importResponse = response as ImportFileResponse;
      if (importResponse.clips.length > 0) {
        console.log(`[MEDIA LIBRARY] Adding ${importResponse.clips.length} clip(s) from drag-and-drop`);
        addClips(importResponse.clips);
      } else {
        console.warn('[MEDIA LIBRARY] DnD import returned 0 clips');
      }
    } catch (err) {
      console.error('[MEDIA LIBRARY] Unexpected error during DnD import:', err);
      alert('An unexpected error occurred during drag-and-drop import');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
          <span>📂</span>
          <span>Media Library</span>
        </h2>
        <p className="text-gray-600">
          Import video files to start editing
        </p>
      </div>

      {/* Import Button */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={handleImportClick}
          disabled={isImporting || isInitializing}
          className={`
            w-full py-4 px-6 rounded-lg font-semibold text-white text-lg
            transition-all duration-200
            ${(isImporting || isInitializing)
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 hover:shadow-lg'
            }
          `}
        >
          {isInitializing ? '⏳ Loading Library...' : isImporting ? '⏳ Opening...' : '➕ Import Video'}
        </button>
        <button
          onClick={() => setShowRecordingPanel(true)}
          className="w-full py-4 px-6 rounded-lg font-semibold text-white text-lg bg-purple-600 hover:bg-purple-700 active:bg-purple-800 transition-all duration-200 hover:shadow-lg"
        >
          🎛️ Open Recording Panel
        </button>
      </div>

      {/* Drag-and-Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-4 border-dashed rounded-xl p-8
          transition-all duration-200 min-h-[200px]
          ${isDragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }
        `}
      >
        {/* Drag-over overlay */}
        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-100 bg-opacity-90 rounded-xl">
            <div className="text-center">
              <div className="text-5xl mb-2">📥</div>
              <p className="text-xl font-semibold text-blue-700">
                Drop video files here
              </p>
              <p className="text-sm text-blue-600 mt-1">
                .mp4, .mov, .webm
              </p>
            </div>
          </div>
        )}

        {/* Clip list or empty state */}
        {clips.length === 0 ? (
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-3">🎬</div>
            <p className="text-lg font-medium mb-1">No videos imported yet</p>
            <p className="text-sm">
              Click &ldquo;Import Video&rdquo; above to start
            </p>
            <p className="text-xs text-gray-400 mt-2">
              (Drag & drop will be enhanced in a future epic)
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">
                Imported Videos ({clips.length})
              </h3>
              <button
                onClick={() => clearAll()}
                className="text-sm text-red-600 hover:text-red-700 hover:underline"
              >
                Clear All
              </button>
            </div>
            <div ref={listRef} className="space-y-3 max-h-[500px] overflow-y-auto">
              {clips.map((clip) => (
                <div
                  key={clip.id}
                  draggable
                  onDragStart={(e) => {
                    try {
                      const payload = {
                        mediaId: clip.id,
                        duration: clip.duration,
                        filename: clip.filename,
                      };
                      e.dataTransfer.setData('application/clipforge-media', JSON.stringify(payload));
                      // Optional: nicer drag image using the thumbnail if available
                      const img = (e.currentTarget as HTMLDivElement).querySelector('img');
                      if (img) {
                        e.dataTransfer.setDragImage(img, 16, 16);
                      }
                    } catch {
                      // Silently fail
                    }
                  }}
                  onClick={() => {
                    selectClip(clip.id);
                    onSelectClip?.(clip);
                  }}
                  className={`flex gap-4 p-4 bg-white border rounded-lg hover:bg-gray-50 transition-colors shadow-sm cursor-pointer
                    ${(selectedClipId ?? storeSelectedClipId) === clip.id ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200'}
                  `}
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0">
                    <img
                      src={`file://${clip.thumbnail}`}
                      alt={clip.filename}
                      className="w-32 h-20 object-cover rounded border border-gray-300"
                      onError={(e) => {
                        // Fallback if thumbnail fails to load
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="80"><rect fill="%23ccc" width="128" height="80"/><text x="50%" y="50%" text-anchor="middle" fill="%23666" font-family="Arial" font-size="12">No Preview</text></svg>';
                      }}
                    />
                  </div>
                  
                  {/* Metadata */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate mb-1">
                      {clip.filename}
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600">⏱️</span>
                        <span>Duration: {formatDuration(clip.duration)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-purple-600">📐</span>
                        <span>Resolution: {formatResolution(clip.width, clip.height)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-600">💾</span>
                        <span>Size: {formatFileSize(clip.size)}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <div className="inline-flex items-center gap-1 text-xs text-gray-600 px-2 py-1 rounded border border-gray-200 bg-gray-50 min-w-0">
                        <span aria-hidden>📁</span>
                        <span className="truncate" title={clip.path}>
                          {`Location: ${formatFolderDisplay(clip.path)}`}
                        </span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); void revealInFolder(clip.path); }}
                        className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                        title="Show this file in Finder"
                      >
                        Show in Finder
                      </button>
                    </div>
                <div className="mt-2 flex items-center gap-2">
                  {clip.subtitlesPath ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 border border-green-200" title={clip.subtitlesPath}>
                      <span>CC</span>
                      <span>Captions</span>
                    </span>
                  ) : null}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (generating.has(clip.id) || clip.subtitlesPath) return;
                      setGenerating((prev) => new Set(prev).add(clip.id));
                      try {
                        const res = await generateCaptions(clip.id, clip.path);
                        if (isIPCError(res)) {
                          alert(`Caption generation failed: ${res.error}`);
                        } else {
                          useMediaStore.getState().updateClip(clip.id, { subtitlesPath: res.srtPath });
                        }
                      } catch (err) {
                        alert(`Caption generation error: ${err instanceof Error ? err.message : String(err)}`);
                      } finally {
                        setGenerating((prev) => { const n = new Set(prev); n.delete(clip.id); return n; });
                      }
                    }}
                    disabled={generating.has(clip.id) || !!clip.subtitlesPath}
                    className={`text-xs px-3 py-1 rounded border transition-colors ${
                      clip.subtitlesPath
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : generating.has(clip.id)
                          ? 'bg-blue-100 text-blue-600 border-blue-200 cursor-wait'
                          : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
                    }`}
                    title={clip.subtitlesPath ? 'Captions already generated' : 'Generate captions (uses OpenAI)'}
                  >
                    {generating.has(clip.id) ? 'Generating…' : 'Generate Captions'}
                  </button>
                </div>
                  </div>
                  
                  {/* Remove button */}
                  <div className="flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeClip(clip.id);
                      }}
                      className="text-red-500 hover:text-red-700 px-3 py-1 rounded hover:bg-red-50 transition-colors"
                      title="Remove clip"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {showRecordingPanel && (
        <RecordingPanel onClose={() => setShowRecordingPanel(false)} />
      )}
    </div>
  );
};

export default MediaLibrary;

