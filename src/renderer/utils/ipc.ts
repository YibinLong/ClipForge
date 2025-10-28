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
} from '../../types/ipc';

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

