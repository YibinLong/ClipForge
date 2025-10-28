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
   * Returns array of selected file paths
   */
  IMPORT_FILE: 'import-file',
  
  // Future channels will be added here as we implement more features:
  // GET_VIDEO_METADATA: 'get-video-metadata',
  // START_RECORDING: 'start-recording',
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
 * This is what the main process sends back after user selects files
 */
export interface ImportFileResponse {
  /** Array of selected file paths (absolute paths) */
  filePaths: string[];
  /** Whether the request was successful */
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
export type IPCResponse = TestMessageResponse | ImportFileResponse;

/**
 * Combined response type that includes potential errors
 * This is what handlers should return
 */
export type IPCResult<T = IPCResponse> = T | IPCErrorResponse;

