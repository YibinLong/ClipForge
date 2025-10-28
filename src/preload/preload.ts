/**
 * ClipForge - Preload Script
 * 
 * This script runs in a special context that has access to both Node.js APIs
 * and the renderer's DOM. It uses contextBridge to safely expose APIs to the renderer.
 * 
 * WHY THIS EXISTS:
 * - The renderer process (React app) runs in a sandboxed environment for security
 * - It can't directly access Node.js APIs or Electron APIs
 * - This preload script acts as a secure bridge between renderer and main process
 * 
 * SECURITY MODEL:
 * - Context isolation is enabled (renderer can't access this script's scope)
 * - Only explicitly exposed methods are available to renderer
 * - Channel names are validated against whitelist
 * - No arbitrary code execution from renderer
 * 
 * See: https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../types/ipc';

/**
 * Allowed IPC channel names
 * 
 * WHY WE NEED THIS:
 * - Prevents renderer from invoking arbitrary channels
 * - Acts as a whitelist for security
 * - Makes it clear which channels are available
 * 
 * SECURITY: Only channels in this list can be invoked from the renderer
 */
const ALLOWED_CHANNELS = Object.values(IPC_CHANNELS);

/**
 * Validate that a channel name is allowed
 * 
 * This prevents the renderer from calling channels that aren't whitelisted
 * For example, it blocks internal Electron channels or typos
 * 
 * @param channel - The channel name to validate
 * @returns true if channel is allowed
 */
function isChannelAllowed(channel: string): boolean {
  const allowed = ALLOWED_CHANNELS.includes(channel as typeof ALLOWED_CHANNELS[number]);
  
  if (!allowed) {
    console.warn(
      `[PRELOAD] Blocked IPC call to unauthorized channel: "${channel}"\n` +
      `Allowed channels: ${ALLOWED_CHANNELS.join(', ')}`
    );
  }
  
  return allowed;
}

/**
 * Expose safe APIs to the renderer process via window.electron
 * 
 * This creates a global `window.electron` object in the renderer that contains
 * only the methods we explicitly expose. This is more secure than enabling
 * nodeIntegration.
 * 
 * SECURITY FEATURES:
 * - Channel name validation (whitelist)
 * - No direct access to ipcRenderer
 * - No access to Node.js require()
 * - Event object is not exposed (prevents security leaks)
 */
contextBridge.exposeInMainWorld('electron', {
  /**
   * Send a message to the main process and wait for a response
   * 
   * SECURITY: Only whitelisted channels are allowed
   * 
   * @param channel - IPC channel name (must be in ALLOWED_CHANNELS)
   * @param args - Arguments to send to the handler
   * @returns Promise resolving to the response from main process
   * 
   * @example
   * const result = await window.electron.invoke('test-message', { message: 'Hello!' })
   */
  invoke: (channel: string, ...args: unknown[]) => {
    // Validate channel is allowed
    if (!isChannelAllowed(channel)) {
      return Promise.reject(new Error(`Channel "${channel}" is not allowed`));
    }
    
    // Forward to main process
    return ipcRenderer.invoke(channel, ...args);
  },

  /**
   * Send a one-way message to the main process (no response expected)
   * 
   * SECURITY: Only whitelisted channels are allowed
   * 
   * @param channel - IPC channel name (must be in ALLOWED_CHANNELS)
   * @param args - Arguments to send
   * 
   * @example
   * window.electron.send('log-event', { event: 'button-clicked' })
   */
  send: (channel: string, ...args: unknown[]) => {
    // Validate channel is allowed
    if (!isChannelAllowed(channel)) {
      console.error(`[PRELOAD] Cannot send to unauthorized channel: "${channel}"`);
      return;
    }
    
    // Forward to main process
    ipcRenderer.send(channel, ...args);
  },

  /**
   * Listen for messages from the main process
   * 
   * SECURITY: Only whitelisted channels are allowed
   * NOTE: The IpcRendererEvent is not exposed to prevent leaking sender info
   * 
   * @param channel - IPC channel name (must be in ALLOWED_CHANNELS)
   * @param callback - Function to call when message received
   * @returns Unsubscribe function
   * 
   * @example
   * const unsubscribe = window.electron.on('export-progress', (progress) => {
   *   console.log('Progress:', progress);
   * });
   */
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    // Validate channel is allowed
    if (!isChannelAllowed(channel)) {
      console.error(`[PRELOAD] Cannot listen to unauthorized channel: "${channel}"`);
      return () => {}; // Return empty unsubscribe function
    }
    
    // Create subscription that strips the event object (security)
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => 
      callback(...args);
    
    // Register listener
    ipcRenderer.on(channel, subscription);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },

  /**
   * Convenience: listen to export progress events
   */
  onExportProgress: (callback: (...args: unknown[]) => void) => {
    if (!isChannelAllowed(IPC_CHANNELS.EXPORT_PROGRESS)) {
      console.error('[PRELOAD] EXPORT_PROGRESS channel not allowed');
      return () => {};
    }
    const sub = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(IPC_CHANNELS.EXPORT_PROGRESS, sub);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.EXPORT_PROGRESS, sub);
  },

  /**
   * Convenience: request export cancellation
   */
  cancelExport: (jobId?: string) => {
    if (!isChannelAllowed(IPC_CHANNELS.CANCEL_EXPORT)) {
      return Promise.reject(new Error('Channel not allowed'));
    }
    return ipcRenderer.invoke(IPC_CHANNELS.CANCEL_EXPORT, { jobId });
  },
});

console.log('✅ Preload script loaded successfully');
console.log(`[PRELOAD] Allowed IPC channels: ${ALLOWED_CHANNELS.join(', ')}`);
