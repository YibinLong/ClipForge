/**
 * TypeScript type definitions for Electron APIs exposed to renderer
 * 
 * WHY THIS FILE EXISTS:
 * - Defines the shape of the window.electron object available in renderer
 * - Provides TypeScript autocomplete and type checking for IPC calls
 * - Ensures type safety when communicating between processes
 * - Makes it clear which APIs are available to the renderer
 * 
 * SECURITY NOTE:
 * - Only methods explicitly exposed via contextBridge are available
 * - This file documents what the renderer can access
 * - No direct Node.js or Electron API access (contextIsolation: true)
 */

import { IPCChannel } from './ipc';

/**
 * ElectronAPI Interface
 * 
 * This interface defines all methods available on window.electron
 * These methods are exposed by the preload script via contextBridge
 */
export interface ElectronAPI {
  /**
   * Send a message to the main process and wait for a response
   * 
   * This is the primary method for IPC communication. It:
   * 1. Sends a message with arguments to the main process
   * 2. Waits for the main process handler to complete
   * 3. Returns the response (or error) from the handler
   * 
   * @param channel - IPC channel name (should be from IPC_CHANNELS)
   * @param args - Arguments to send to the handler
   * @returns Promise resolving to the response from main process
   * 
   * @example
   * const response = await window.electron.invoke('test-message', { message: 'Hello!' });
   */
  invoke: <T = unknown>(channel: IPCChannel | string, ...args: unknown[]) => Promise<T>;

  /**
   * Send a one-way message to the main process (no response expected)
   * 
   * Use this for fire-and-forget messages where you don't need a response
   * Example: logging events, notifications, etc.
   * 
   * @param channel - IPC channel name
   * @param args - Arguments to send
   * 
   * @example
   * window.electron.send('log-event', { event: 'user-clicked-button' });
   */
  send: (channel: IPCChannel | string, ...args: unknown[]) => void;

  /**
   * Listen for messages from the main process
   * 
   * Use this to receive push notifications from main → renderer
   * Example: export progress updates, error notifications, etc.
   * 
   * @param channel - IPC channel name to listen on
   * @param callback - Function to call when message received
   * @returns Unsubscribe function (call to stop listening)
   * 
   * @example
   * const unsubscribe = window.electron.on('export-progress', (progress) => {
   *   console.log('Export progress:', progress);
   * });
   * 
   * // Later, to stop listening:
   * unsubscribe();
   */
  on: (channel: IPCChannel | string, callback: (...args: unknown[]) => void) => () => void;

  /**
   * Resolve absolute path for a dropped File (from Finder/Explorer).
   * Returns null if unavailable.
   */
  getPathForFile: (file: File) => string | null;
}

/**
 * Global type augmentation
 * 
 * This adds the electron property to the Window interface
 * TypeScript will now recognize window.electron throughout the renderer
 */
declare global {
  interface Window {
    /**
     * Electron API exposed via preload script
     * 
     * Available in renderer process only
     * Provides secure bridge to main process via IPC
     */
    electron: ElectronAPI;
  }
}

// This export is required for TypeScript module resolution
export {};

