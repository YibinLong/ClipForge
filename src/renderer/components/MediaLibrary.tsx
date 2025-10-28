/**
 * MediaLibrary Component
 * 
 * WHY THIS COMPONENT EXISTS:
 * - Provides UI for importing video files into ClipForge
 * - Supports two import methods: file picker button and drag-and-drop
 * - Displays list of imported video files
 * 
 * FEATURES:
 * - "Import Video" button that opens native file dialog
 * - Drag-and-drop zone with visual feedback
 * - File type validation (only .mp4, .mov, .webm)
 * - Displays full file paths (thumbnails/metadata come in Epic 2.2)
 * 
 * STATE:
 * - Local state for now (Epic 2.4 will migrate to Zustand store)
 * - Cumulative imports (each import/drop adds to existing list)
 */

import React, { useState } from 'react';
import { isIPCError, ImportFileResponse } from '../../types/ipc';

/**
 * MediaLibrary Component
 * 
 * Renders the media library UI with import functionality
 */
const MediaLibrary: React.FC = () => {
  // State to track imported video file paths
  const [filePaths, setFilePaths] = useState<string[]>([]);
  
  // State to track drag-over state for visual feedback
  const [isDragOver, setIsDragOver] = useState(false);
  
  // State to track loading state during import
  const [isImporting, setIsImporting] = useState(false);

  /**
   * Handle "Import Video" button click
   * 
   * Opens native file dialog via IPC call to main process
   * Adds selected files to the media library list
   */
  const handleImportClick = async () => {
    try {
      setIsImporting(true);
      console.log('[MEDIA LIBRARY] Opening file dialog...');

      // Call IPC handler to open file dialog
      const response = await window.electron.invoke('import-file');

      // Check for errors
      if (isIPCError(response)) {
        console.error('[MEDIA LIBRARY] Import error:', response.error);
        alert(`Import failed: ${response.error}`);
        return;
      }

      // TypeScript type assertion: response is ImportFileResponse after error check
      const importResponse = response as ImportFileResponse;

      // Add selected files to state (cumulative)
      if (importResponse.filePaths.length > 0) {
        console.log(`[MEDIA LIBRARY] Adding ${importResponse.filePaths.length} file(s)`);
        setFilePaths(prev => [...prev, ...importResponse.filePaths]);
      } else {
        console.log('[MEDIA LIBRARY] No files selected');
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
   * Handle drag leave event
   * 
   * Resets visual feedback state
   */
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  /**
   * Handle file drop event
   * 
   * Extracts file paths from dropped files
   * Validates file extensions (only .mp4, .mov, .webm)
   * Adds valid files to state
   */
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    console.log('[MEDIA LIBRARY] Files dropped');

    // Extract files from DataTransfer
    const droppedFiles = Array.from(e.dataTransfer.files);
    console.log('[MEDIA LIBRARY] Dropped files count:', droppedFiles.length);
    
    // Filter for valid video file extensions
    const validExtensions = ['.mp4', '.mov', '.webm'];
    const validFiles = droppedFiles.filter(file => {
      const fileName = file.name.toLowerCase();
      return validExtensions.some(ext => fileName.endsWith(ext));
    });

    if (validFiles.length === 0) {
      console.log('[MEDIA LIBRARY] No valid video files dropped');
      alert('Please drop valid video files (.mp4, .mov, .webm)');
      return;
    }

    // Extract file paths from File objects
    // Note: file.path is an Electron-specific property
    console.log('[MEDIA LIBRARY] Valid files:', validFiles.map(f => ({ name: f.name, path: (f as any).path })));
    
    const newFilePaths = validFiles
      .map(file => (file as any).path)
      .filter((path): path is string => path !== undefined && path !== null);
    
    if (newFilePaths.length === 0) {
      console.log('[MEDIA LIBRARY] No valid file paths extracted from dropped files');
      alert('Could not extract file paths. Please try using the Import button instead.');
      return;
    }
    
    console.log(`[MEDIA LIBRARY] Adding ${newFilePaths.length} dropped file(s)`);
    
    // Add to state (cumulative)
    setFilePaths(prev => [...prev, ...newFilePaths]);
  };

  /**
   * Extract filename from full path
   * 
   * @param path - Full file path
   * @returns Just the filename
   */
  const getFileName = (path: string): string => {
    if (!path) return 'Unknown file';
    return path.split(/[\\/]/).pop() || path;
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
      <div className="mb-6">
        <button
          onClick={handleImportClick}
          disabled={isImporting}
          className={`
            w-full py-4 px-6 rounded-lg font-semibold text-white text-lg
            transition-all duration-200
            ${isImporting 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 hover:shadow-lg'
            }
          `}
        >
          {isImporting ? '⏳ Opening...' : '➕ Import Video'}
        </button>
      </div>

      {/* Drag-and-Drop Zone */}
      <div
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

        {/* File list or empty state */}
        {filePaths.length === 0 ? (
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-3">🎬</div>
            <p className="text-lg font-medium mb-1">No videos imported yet</p>
            <p className="text-sm">
              Click "Import Video" above or drag & drop video files here
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">
                Imported Files ({filePaths.length})
              </h3>
              <button
                onClick={() => setFilePaths([])}
                className="text-sm text-red-600 hover:text-red-700 hover:underline"
              >
                Clear All
              </button>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filePaths.map((path, index) => (
                <div
                  key={`${path}-${index}`}
                  className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="text-2xl">🎥</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {getFileName(path)}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {path}
                    </p>
                  </div>
                  <button
                    onClick={() => setFilePaths(prev => prev.filter((_, i) => i !== index))}
                    className="text-red-500 hover:text-red-700 px-2"
                    title="Remove file"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>Supported formats: MP4, MOV, WebM</p>
        <p className="text-xs mt-1">
          Epic 2.1: File Import System - Complete
        </p>
      </div>
    </div>
  );
};

export default MediaLibrary;

