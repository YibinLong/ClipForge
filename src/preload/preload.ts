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
 * See: https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * Expose safe APIs to the renderer process via window.electron
 * 
 * This creates a global `window.electron` object in the renderer that contains
 * only the methods we explicitly expose. This is more secure than enabling
 * nodeIntegration.
 */
contextBridge.exposeInMainWorld('electron', {
  /**
   * Send a message to the main process and wait for a response
   * Usage in renderer: const result = await window.electron.invoke('channel-name', arg1, arg2)
   */
  invoke: (channel: string, ...args: unknown[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },

  /**
   * Send a one-way message to the main process (no response expected)
   * Usage in renderer: window.electron.send('channel-name', arg1, arg2)
   */
  send: (channel: string, ...args: unknown[]) => {
    ipcRenderer.send(channel, ...args);
  },

  /**
   * Listen for messages from the main process
   * Usage in renderer: window.electron.on('channel-name', (data) => { ... })
   */
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => 
      callback(...args);
    ipcRenderer.on(channel, subscription);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
});

/**
 * TypeScript type definitions for window.electron
 * These will be used in the renderer process for type safety
 */
declare global {
  interface Window {
    electron: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      send: (channel: string, ...args: unknown[]) => void;
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
    };
  }
}

console.log('✅ Preload script loaded successfully');
