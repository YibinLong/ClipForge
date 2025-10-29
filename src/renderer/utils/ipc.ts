/**
 * Type-Safe IPC Utility Functions
 * 
 * WHY THIS FILE EXISTS:
 * - Provides type-safe wrappers around window.electron.invoke()
 * - Prevents typos in channel names
 * - Ensures request/response types match channel definitions
 * - Makes it easier to call IPC from anywhere in the renderer
 * 
 * USAGE:
 * Instead of: window.electron.invoke('test-message', { message: 'hi' })
 * Use: testMessage('hi')
 * 
 * Benefits:
 * - TypeScript autocomplete for function names and parameters
 * - Compile-time type checking
 * - Cleaner, more readable code
 */

import {
  IPC_CHANNELS,
  TestMessageRequest,
  TestMessageResponse,
  IPCErrorResponse,
  isIPCError,
  SaveMediaLibraryRequest,
  SaveMediaLibraryResponse,
  LoadMediaLibraryResponse,
  StartExportTimelineRequest,
  StartExportResponse,
  ExportProgressEvent,
  CancelExportResponse,
  GetScreenSourcesResponse,
  SetCaptureSourceRequest,
  SetCaptureSourceResponse,
  SaveRecordingFileRequest,
  SaveRecordingFileResponse,
  TranscodeWebmToMp4Request,
  TranscodeWebmToMp4Response,
  ChooseRecordingOutputResponse,
  OpenRecordingsFolderResponse,
  GenerateCaptionsRequest,
  GenerateCaptionsResponse,
  GenerateCaptionsProgressEvent,
} from '../../types/ipc';
import { MediaClip } from '../../types/media';

/**
 * Call the test-message IPC handler
 * 
 * Sends a message to the main process and receives an echo response
 * 
 * @param message - The message to send
 * @returns Promise resolving to the response or error
 * 
 * @example
 * const result = await testMessage('Hello, main process!');
 * if (isIPCError(result)) {
 *   console.error('Error:', result.error);
 * } else {
 *   console.log('Reply:', result.reply);
 *   console.log('Timestamp:', new Date(result.timestamp));
 * }
 */
export async function testMessage(
  message: string
): Promise<TestMessageResponse | IPCErrorResponse> {
  const request: TestMessageRequest = { message };
  
  const response = await window.electron.invoke(
    IPC_CHANNELS.TEST_MESSAGE,
    request
  );
  
  return response as TestMessageResponse | IPCErrorResponse;
}

/**
 * Generic IPC invoke wrapper with type safety
 * 
 * This is a lower-level function that can be used for any IPC channel
 * Prefer using specific functions like testMessage() when available
 * 
 * @param channel - The IPC channel to invoke
 * @param args - Arguments to pass to the handler
 * @returns Promise resolving to the response
 */
export async function invokeIPC<T = unknown>(
  channel: string,
  ...args: unknown[]
): Promise<T> {
  const response = await window.electron.invoke(channel, ...args);
  return response as T;
}

// Export the type guard for convenience
export { isIPCError };

// ============================================================================
// Media Library Persistence helpers
// ============================================================================

export async function saveMediaLibrary(clips: MediaClip[]): Promise<SaveMediaLibraryResponse | IPCErrorResponse> {
  const req: SaveMediaLibraryRequest = { clips };
  return window.electron.invoke(
    IPC_CHANNELS.SAVE_MEDIA_LIBRARY,
    req
  ) as Promise<SaveMediaLibraryResponse | IPCErrorResponse>;
}

export async function loadMediaLibrary(): Promise<MediaClip[] | IPCErrorResponse> {
  const res = (await window.electron.invoke(
    IPC_CHANNELS.LOAD_MEDIA_LIBRARY
  )) as LoadMediaLibraryResponse | IPCErrorResponse;

  if (isIPCError(res)) return res;
  return res.clips;
}

// ============================================================================
// Export helpers (Epic 5.1)
// ============================================================================

export async function startExportTimeline(
  req: StartExportTimelineRequest
): Promise<StartExportResponse | IPCErrorResponse> {
  return window.electron.invoke(
    IPC_CHANNELS.START_EXPORT,
    req
  ) as Promise<StartExportResponse | IPCErrorResponse>;
}

export function onExportProgress(
  cb: (e: ExportProgressEvent) => void
): () => void {
  return window.electron.on(IPC_CHANNELS.EXPORT_PROGRESS, (...args: unknown[]) => cb(args[0] as ExportProgressEvent));
}

export async function cancelExport(jobId?: string): Promise<CancelExportResponse | IPCErrorResponse> {
  return window.electron.invoke(
    IPC_CHANNELS.CANCEL_EXPORT,
    { jobId }
  ) as Promise<CancelExportResponse | IPCErrorResponse>;
}

// ============================================================================
// Screen recording helpers (Epic 7.1)
// ============================================================================

export async function getScreenSources(includeWindows: boolean): Promise<GetScreenSourcesResponse | IPCErrorResponse> {
  return window.electron.invoke(
    IPC_CHANNELS.GET_SCREEN_SOURCES,
    { includeWindows }
  ) as Promise<GetScreenSourcesResponse | IPCErrorResponse>;
}

export async function setCaptureSource(sourceId: string): Promise<SetCaptureSourceResponse | IPCErrorResponse> {
  const req: SetCaptureSourceRequest = { sourceId };
  return window.electron.invoke(
    IPC_CHANNELS.SET_CAPTURE_SOURCE,
    req
  ) as Promise<SetCaptureSourceResponse | IPCErrorResponse>;
}

export async function saveRecordingFile(data: ArrayBuffer, filenameHint?: string): Promise<SaveRecordingFileResponse | IPCErrorResponse> {
  const req: SaveRecordingFileRequest = { data, filenameHint };
  return window.electron.invoke(
    IPC_CHANNELS.SAVE_RECORDING_FILE,
    req
  ) as Promise<SaveRecordingFileResponse | IPCErrorResponse>;
}

export async function transcodeWebmToMp4(inputPath: string, outputPath?: string): Promise<TranscodeWebmToMp4Response | IPCErrorResponse> {
  const req: TranscodeWebmToMp4Request = { inputPath, outputPath };
  return window.electron.invoke(
    IPC_CHANNELS.TRANSCODE_WEBM_TO_MP4,
    req
  ) as Promise<TranscodeWebmToMp4Response | IPCErrorResponse>;
}

export async function chooseRecordingOutput(): Promise<ChooseRecordingOutputResponse | IPCErrorResponse> {
  return window.electron.invoke(
    IPC_CHANNELS.CHOOSE_RECORDING_OUTPUT
  ) as Promise<ChooseRecordingOutputResponse | IPCErrorResponse>;
}

export async function openRecordingsFolder(): Promise<OpenRecordingsFolderResponse | IPCErrorResponse> {
  return window.electron.invoke(
    IPC_CHANNELS.OPEN_RECORDINGS_FOLDER
  ) as Promise<OpenRecordingsFolderResponse | IPCErrorResponse>;
}

// ============================================================================
// Captions (Epic 7.6)
// ============================================================================

export async function generateCaptions(
  clipId: string,
  videoPath: string
): Promise<GenerateCaptionsResponse | IPCErrorResponse> {
  const req: GenerateCaptionsRequest = { clipId, videoPath };
  return window.electron.invoke(
    IPC_CHANNELS.GENERATE_CAPTIONS,
    req
  ) as Promise<GenerateCaptionsResponse | IPCErrorResponse>;
}

export function onGenerateCaptionsProgress(
  cb: (e: GenerateCaptionsProgressEvent) => void
): () => void {
  return window.electron.on(
    IPC_CHANNELS.GENERATE_CAPTIONS_PROGRESS,
    (...args: unknown[]) => cb(args[0] as GenerateCaptionsProgressEvent)
  );
}

