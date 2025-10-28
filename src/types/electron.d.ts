/**
 * TypeScript type definitions for Electron APIs exposed to renderer
 * 
 * This file defines the shape of the window.electron object that's available
 * in the renderer process. It provides autocomplete and type checking.
 */

export interface ElectronAPI {
  /**
   * Send a message to the main process and wait for a response
   * @param channel - IPC channel name
   * @param args - Arguments to send
   * @returns Promise resolving to the response from main process
   */
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;

  /**
   * Send a one-way message to the main process (no response)
   * @param channel - IPC channel name
   * @param args - Arguments to send
   */
  send: (channel: string, ...args: unknown[]) => void;

  /**
   * Listen for messages from the main process
   * @param channel - IPC channel name
   * @param callback - Function to call when message received
   * @returns Unsubscribe function
   */
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

