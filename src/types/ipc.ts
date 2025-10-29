/**
 * IPC Channel Definitions and Type Safety
 * 
 * WHY THIS FILE EXISTS:
 * - Centralizes all IPC channel names as constants to prevent typos
 * - Provides TypeScript type definitions for request/response messages
 * - Ensures type safety across main and renderer processes
 * - Makes it easy to add new IPC channels in the future
 * 
 * NAMING CONVENTION:
 * - Channel names use kebab-case (e.g., 'test-message')
 * - Constant names use SCREAMING_SNAKE_CASE (e.g., TEST_MESSAGE)
 * - Request/Response interfaces use PascalCase with suffix (e.g., TestMessageRequest)
 */

import { MediaClip } from './media';
import { TimelineClip } from './timeline';

/**
 * IPC_CHANNELS - All available IPC channel names
 * 
 * Using 'as const' makes this a readonly object with literal string types
 * This allows TypeScript to provide better autocomplete and type checking
 */
export const IPC_CHANNELS = {
  /**
   * Test channel for verifying IPC infrastructure works correctly
   * Accepts a message string and returns an echo response with timestamp
   */
  TEST_MESSAGE: 'test-message',
  
  /**
   * Import file channel for opening file picker dialog
   * Opens native file dialog to select video files (.mp4, .mov, .webm)
   * Extracts metadata and generates thumbnails for each file
   * Returns array of complete MediaClip objects
   */
  IMPORT_FILE: 'import-file',
  /**
   * Import files directly by absolute paths (used for drag-and-drop)
   * Returns array of complete MediaClip objects after FFmpeg processing
   */
  IMPORT_FILE_PATHS: 'import-file-paths',
  
  /**
   * Persist media library to disk via main process (electron-store)
   */
  SAVE_MEDIA_LIBRARY: 'save-media-library',
  
  /**
   * Load media library from disk via main process (electron-store)
   */
  LOAD_MEDIA_LIBRARY: 'load-media-library',
  
  /**
   * Start export of the timeline (Epic 5.1 - Track 1 only, single-clip MVP)
   */
  START_EXPORT: 'start-export',
  
  /**
   * Streaming progress events for export jobs
   */
  EXPORT_PROGRESS: 'export-progress',

  /**
   * Cancel an in-flight export job
   */
  CANCEL_EXPORT: 'cancel-export',
  
  // Future channels will be added here as we implement more features:
  // START_RECORDING: 'start-recording',
  // EXPORT_VIDEO: 'export-video',
  // etc.
} as const;

/**
 * Type representing any valid IPC channel name
 * This is extracted from the IPC_CHANNELS object
 */
export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

// ============================================================================
// TEST MESSAGE HANDLER
// ============================================================================

/**
 * Request payload for test-message channel
 * 
 * This is what the renderer sends to the main process
 */
export interface TestMessageRequest {
  /** The message to echo back */
  message: string;
}

/**
 * Response payload for test-message channel
 * 
 * This is what the main process sends back to the renderer
 */
export interface TestMessageResponse {
  /** The echoed message with 'Echo: ' prefix */
  reply: string;
  /** Unix timestamp (milliseconds) when the message was processed */
  timestamp: number;
  /** Whether the request was successful */
  success: true;
}

// ============================================================================
// IMPORT FILE HANDLER
// ============================================================================

/**
 * Response payload for import-file channel
 * 
 * This is what the main process sends back after user selects files.
 * Each file is processed to extract metadata and generate a thumbnail.
 * 
 * CHANGED IN EPIC 2.2:
 * - Previously returned filePaths: string[]
 * - Now returns clips: MediaClip[] with full metadata
 */
export interface ImportFileResponse {
  /** Array of MediaClip objects with metadata and thumbnails */
  clips: MediaClip[];
  /** Whether the request was successful */
  success: true;
}

/**
 * Request payload for import-file-paths channel
 */
export interface ImportFilePathsRequest {
  /** Absolute file paths dropped by the user */
  paths: string[];
}

// ============================================================================
// MEDIA LIBRARY PERSISTENCE
// ============================================================================

export interface SaveMediaLibraryRequest {
  clips: MediaClip[];
}

export interface SaveMediaLibraryResponse {
  success: true;
}

export interface LoadMediaLibraryResponse {
  success: true;
  clips: MediaClip[];
}

// ============================================================================
// EXPORT - EPIC 5.1 (Entire Timeline, Track 1 only MVP)
// ============================================================================

export interface StartExportTimelineRequest {
  timeline: TimelineClip[];
  media: MediaClip[];
  trackId: number;
  suggestedName?: string;
  /** Target resolution for export. Defaults to 'source' */
  resolution?: 'source' | '720p' | '1080p';
}

export interface StartExportSuccessResponse {
  success: true;
  outputPath: string;
  /** Identifier for the export job (used for progress/cancel) */
  jobId?: string;
}

export type StartExportResponse = StartExportSuccessResponse;

// =========================================================================
// EXPORT PROGRESS & CANCEL (Epics 5.3 & 5.2)
// =========================================================================

export interface ExportProgressEvent {
  jobId: string;
  percent: number; // 0..100
  currentSeconds: number; // processed
  etaSeconds?: number;
  status: 'processing' | 'complete' | 'error' | 'cancelled';
  errorMessage?: string;
}

export interface CancelExportRequest {
  jobId?: string;
}

export interface CancelExportResponse {
  success: true;
}

/**
 * Error response structure used across all IPC handlers
 * 
 * WHY WE NEED THIS:
 * - Provides consistent error format across all handlers
 * - Helps renderer code handle errors uniformly
 * - Includes both user-friendly messages and technical details
 */
export interface IPCErrorResponse {
  /** Indicates this is an error response */
  success: false;
  /** User-friendly error message */
  error: string;
  /** Technical error details (for logging/debugging) */
  details?: string;
}

// ============================================================================
// TYPE HELPERS
// ============================================================================

/**
 * Type guard to check if a response is an error
 * 
 * USAGE:
 * const response = await window.electron.invoke('test-message', { message: 'hi' });
 * if (isIPCError(response)) {
 *   console.error(response.error);
 * } else {
 *   console.log(response.reply);
 * }
 */
export function isIPCError(response: unknown): response is IPCErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    (response as { success: boolean }).success === false
  );
}

/**
 * Union type of all successful response types
 * Add new response types here as we implement more handlers
 */
export type IPCResponse = 
  | TestMessageResponse 
  | ImportFileResponse
  | SaveMediaLibraryResponse
  | LoadMediaLibraryResponse
  | StartExportResponse
  | CancelExportResponse;

/**
 * Combined response type that includes potential errors
 * This is what handlers should return
 */
export type IPCResult<T = IPCResponse> = T | IPCErrorResponse;

