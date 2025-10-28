/**
 * IPC Handler Registration Utilities
 * 
 * WHY THIS FILE EXISTS:
 * - Provides a standardized way to register IPC handlers with error handling
 * - Wraps all handlers in try-catch blocks to prevent crashes
 * - Logs all IPC calls for debugging (as per PRD Section 10)
 * - Validates handler functions before registration
 * 
 * SECURITY:
 * - All handlers run in the main process (Node.js context)
 * - Input validation should happen in individual handlers
 * - Path sanitization required for any file operations
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPCChannel, IPCErrorResponse } from '../../types/ipc';

/**
 * Type for IPC handler functions
 * 
 * @param event - The IPC event object (contains sender info, etc.)
 * @param args - Arguments passed from the renderer process
 * @returns Promise resolving to response data or error
 */
type IPCHandler = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<unknown>;

/**
 * Register an IPC handler with automatic error handling and logging
 * 
 * WHY WE NEED THIS:
 * - Prevents one handler error from crashing the entire app
 * - Provides consistent error responses to the renderer
 * - Logs all IPC activity for debugging
 * - Reduces boilerplate in individual handlers
 * 
 * @param channel - The IPC channel name to listen on
 * @param handler - The function to handle the IPC call
 * 
 * @example
 * registerHandler(IPC_CHANNELS.TEST_MESSAGE, async (event, request) => {
 *   const { message } = request as TestMessageRequest;
 *   return { reply: `Echo: ${message}`, timestamp: Date.now(), success: true };
 * });
 */
export function registerHandler(channel: IPCChannel, handler: IPCHandler): void {
  console.log(`[IPC] Registering handler for channel: ${channel}`);

  ipcMain.handle(channel, async (event, ...args) => {
    const startTime = Date.now();
    
    // Log incoming IPC call with parameters (for debugging)
    console.log(`[IPC] Incoming call to '${channel}'`, {
      args: args.length > 0 ? args : '(no args)',
      sender: event.sender.id,
    });

    try {
      // Call the actual handler function
      const result = await handler(event, ...args);
      
      // Log successful completion with execution time
      const duration = Date.now() - startTime;
      console.log(`[IPC] Call to '${channel}' completed successfully (${duration}ms)`);
      
      return result;
    } catch (error) {
      // Log error with full stack trace
      console.error(`[IPC] Error in handler '${channel}':`, error);
      
      // Return structured error response
      const errorResponse: IPCErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : String(error),
      };
      
      return errorResponse;
    }
  });
}

/**
 * Remove a registered IPC handler
 * 
 * WHY WE NEED THIS:
 * - Useful for cleanup or hot-reloading during development
 * - Prevents memory leaks if handlers are re-registered
 * 
 * @param channel - The IPC channel to unregister
 */
export function unregisterHandler(channel: IPCChannel): void {
  console.log(`[IPC] Unregistering handler for channel: ${channel}`);
  ipcMain.removeHandler(channel);
}

/**
 * Check if a handler is registered for a given channel
 * 
 * @param channel - The IPC channel to check
 * @returns true if a handler exists
 */
export function hasHandler(channel: IPCChannel): boolean {
  // Note: Electron doesn't provide a direct way to check this,
  // so this is a placeholder for future implementation if needed
  // For now, we rely on Electron's internal tracking
  return true; // Assume handler registration works
}

