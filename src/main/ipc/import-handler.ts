/**
 * Import File IPC Handler
 * 
 * WHY THIS FILE EXISTS:
 * - Handles file import requests from the renderer process
 * - Opens native file dialog to select video files
 * - Extracts metadata and generates thumbnails using FFmpeg
 * - Returns complete MediaClip objects with all metadata
 * 
 * UPDATED IN EPIC 2.2:
 * - Now processes each file through FFmpeg service
 * - Generates thumbnails for each imported video
 * - Returns MediaClip objects instead of just file paths
 * 
 * SECURITY:
 * - Uses Electron's dialog API which is sandboxed and safe
 * - File filters prevent users from selecting invalid file types
 * - FFmpeg operations run in main process (not renderer)
 */

import { dialog, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import { ImportFileResponse, IPCErrorResponse } from '../../types/ipc';
import { MediaClip } from '../../types/media';
import { processVideoFile } from '../services/ffmpeg';

/**
 * Generate a unique ID for a media clip
 * 
 * Simple timestamp-based ID generation.
 * Format: timestamp-randomstring (e.g., "1635789123456-abc123")
 * 
 * WHY THIS APPROACH:
 * - Timestamp ensures uniqueness across time
 * - Random suffix prevents collisions if multiple imports happen simultaneously
 * - No external dependencies (no need for UUID library)
 * 
 * @returns Unique clip ID string
 */
function generateClipId(): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomString}`;
}

/**
 * Handle import-file IPC requests
 * 
 * Opens a native file picker dialog allowing users to select video files.
 * Processes each selected file through FFmpeg to extract metadata and generate thumbnails.
 * Returns complete MediaClip objects ready for display in the media library.
 * 
 * EPIC 2.2 UPDATES:
 * - Now extracts metadata (duration, resolution, file size) for each file
 * - Generates thumbnail images for preview
 * - Returns MediaClip objects instead of just file paths
 * - Handles processing errors gracefully (failed files are skipped with warnings)
 * 
 * IMPLEMENTATION DETAILS:
 * - Uses dialog.showOpenDialog() from Electron
 * - Processes files sequentially to avoid overwhelming FFmpeg
 * - Each file gets a unique ID for thumbnail naming
 * - Failed files are logged but don't stop the entire import
 * 
 * @param event - IPC event object (not used but required by signature)
 * @returns Promise resolving to ImportFileResponse (with MediaClip[]) or IPCErrorResponse
 * 
 * @example
 * // From renderer:
 * const result = await window.electron.invoke('import-file');
 * if (result.success) {
 *   result.clips.forEach(clip => {
 *     console.log(`${clip.filename}: ${clip.duration}s, ${clip.width}x${clip.height}`);
 *   });
 * }
 */
export async function handleImportFile(
  event: IpcMainInvokeEvent
): Promise<ImportFileResponse | IPCErrorResponse> {
  try {
    console.log('[IMPORT] Opening file dialog for video selection...');

    // Open native file dialog with video file filters
    const result = await dialog.showOpenDialog({
      // Allow selecting multiple files at once
      properties: ['openFile', 'multiSelections'],
      
      // Filter for video file formats (as per PRD Section 5)
      filters: [
        { 
          name: 'Videos', 
          extensions: ['mp4', 'mov', 'webm'] 
        },
        // Optional: Allow "All Files" as fallback
        { 
          name: 'All Files', 
          extensions: ['*'] 
        }
      ],
      
      // Dialog title
      title: 'Import Video Files',
    });

    // Check if user cancelled the dialog
    if (result.canceled) {
      console.log('[IMPORT] File dialog cancelled by user');
      
      // Return empty array (not an error - user simply cancelled)
      return {
        clips: [],
        success: true,
      };
    }

    // Log selected files
    console.log(`[IMPORT] User selected ${result.filePaths.length} file(s):`, result.filePaths);

    // Process each file: extract metadata and generate thumbnail
    // We process sequentially to avoid overwhelming FFmpeg
    const clips: MediaClip[] = [];
    
    for (const filePath of result.filePaths) {
      try {
        console.log(`[IMPORT] Processing file: ${filePath}`);
        
        // Generate unique ID for this clip
        const clipId = generateClipId();
        
        // Extract filename from path
        const filename = path.basename(filePath);
        
        // Process video: extract metadata and generate thumbnail
        // This calls FFmpeg's ffprobe and screenshots functions
        const videoData = await processVideoFile(filePath, clipId);
        
        // Construct complete MediaClip object
        const clip: MediaClip = {
          id: clipId,
          filename,
          path: filePath,
          duration: videoData.duration,
          width: videoData.width,
          height: videoData.height,
          size: videoData.size,
          thumbnail: videoData.thumbnail,
        };
        
        clips.push(clip);
        console.log(`[IMPORT] Successfully processed: ${filename}`);
      } catch (fileError) {
        // Log error but continue processing other files
        // This prevents one corrupted file from stopping the entire import
        console.error(`[IMPORT] Failed to process file ${filePath}:`, fileError);
        console.warn(`[IMPORT] Skipping file: ${path.basename(filePath)}`);
        // In the future, we could add a "partial success" response
        // For now, we just skip failed files
      }
    }

    console.log(`[IMPORT] Successfully processed ${clips.length} of ${result.filePaths.length} file(s)`);

    // Return the processed clips
    return {
      clips,
      success: true,
    };
  } catch (error) {
    // Log the error for debugging
    console.error('[IMPORT] Error during import process:', error);

    // Return structured error response
    return {
      success: false,
      error: 'Failed to import files',
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

