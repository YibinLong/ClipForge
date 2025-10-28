/**
 * Import File IPC Handler
 * 
 * WHY THIS FILE EXISTS:
 * - Handles file import requests from the renderer process
 * - Opens native file dialog to select video files
 * - Returns selected file paths to renderer for processing
 * 
 * SECURITY:
 * - Uses Electron's dialog API which is sandboxed and safe
 * - File filters prevent users from selecting invalid file types
 * - Returns only file paths (no direct file system access from renderer)
 */

import { dialog, IpcMainInvokeEvent } from 'electron';
import { ImportFileResponse, IPCErrorResponse } from '../../types/ipc';

/**
 * Handle import-file IPC requests
 * 
 * Opens a native file picker dialog allowing users to select video files.
 * Supports multiple file selection and filters for MP4, MOV, and WebM formats.
 * 
 * IMPLEMENTATION DETAILS:
 * - Uses dialog.showOpenDialog() from Electron (as per Context7 docs)
 * - Configured with 'openFile' and 'multiSelections' properties
 * - File filters restrict to video formats (.mp4, .mov, .webm)
 * - Returns empty array if user cancels dialog (not an error)
 * 
 * @param event - IPC event object (not used but required by signature)
 * @returns Promise resolving to ImportFileResponse or IPCErrorResponse
 * 
 * @example
 * // From renderer:
 * const result = await window.electron.invoke('import-file');
 * if (result.success) {
 *   console.log('Selected files:', result.filePaths);
 * }
 */
export async function handleImportFile(
  event: IpcMainInvokeEvent
): Promise<ImportFileResponse | IPCErrorResponse> {
  try {
    console.log('[IMPORT] Opening file dialog for video selection...');

    // Open native file dialog with video file filters
    // Using Context7 documentation for dialog.showOpenDialog
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
      
      // Optional: Set default path to user's Videos folder
      // defaultPath: app.getPath('videos'), // Uncomment if desired
    });

    // Check if user cancelled the dialog
    if (result.canceled) {
      console.log('[IMPORT] File dialog cancelled by user');
      
      // Return empty array (not an error - user simply cancelled)
      return {
        filePaths: [],
        success: true,
      };
    }

    // Log selected files
    console.log(`[IMPORT] User selected ${result.filePaths.length} file(s):`, result.filePaths);

    // Return the selected file paths
    return {
      filePaths: result.filePaths,
      success: true,
    };
  } catch (error) {
    // Log the error for debugging
    console.error('[IMPORT] Error opening file dialog:', error);

    // Return structured error response
    return {
      success: false,
      error: 'Failed to open file dialog',
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

