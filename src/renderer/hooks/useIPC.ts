/**
 * React Hooks for IPC Calls
 * 
 * WHY THIS FILE EXISTS:
 * - Provides React hooks for making IPC calls with built-in state management
 * - Handles loading states, errors, and data automatically
 * - Follows React best practices (hooks pattern)
 * - Makes IPC calls easier to use in components
 * 
 * USAGE:
 * const { data, error, isLoading, invoke } = useIPCInvoke();
 * 
 * const handleClick = async () => {
 *   const result = await invoke('test-message', { message: 'Hello!' });
 * };
 */

import { useState, useCallback } from 'react';
import { isIPCError, IPCErrorResponse } from '../../types/ipc';

/**
 * State returned by useIPCInvoke hook
 */
interface IPCInvokeState<T> {
  /** The data returned from the IPC call (null if not yet called or error occurred) */
  data: T | null;
  /** Error message if the call failed */
  error: string | null;
  /** Whether an IPC call is currently in progress */
  isLoading: boolean;
  /** Function to invoke the IPC call */
  invoke: (channel: string, ...args: unknown[]) => Promise<T | null>;
  /** Reset the state to initial values */
  reset: () => void;
}

/**
 * Hook for making IPC calls with automatic state management
 * 
 * WHY USE THIS:
 * - Automatically tracks loading state
 * - Handles errors gracefully
 * - Provides consistent API across components
 * - Reduces boilerplate code
 * 
 * @returns State object with data, error, isLoading, invoke function, and reset function
 * 
 * @example
 * function MyComponent() {
 *   const { data, error, isLoading, invoke } = useIPCInvoke<TestMessageResponse>();
 * 
 *   const handleTest = async () => {
 *     await invoke('test-message', { message: 'Hello!' });
 *   };
 * 
 *   return (
 *     <div>
 *       <button onClick={handleTest} disabled={isLoading}>
 *         {isLoading ? 'Sending...' : 'Send Message'}
 *       </button>
 *       {error && <div className="error">{error}</div>}
 *       {data && <div className="success">{data.reply}</div>}
 *     </div>
 *   );
 * }
 */
export function useIPCInvoke<T = unknown>(): IPCInvokeState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Invoke an IPC call
   * 
   * This function:
   * 1. Sets loading state to true
   * 2. Clears previous data and errors
   * 3. Makes the IPC call
   * 4. Handles success/error responses
   * 5. Updates state accordingly
   */
  const invoke = useCallback(async (channel: string, ...args: unknown[]): Promise<T | null> => {
    // Start loading, clear previous state
    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      // Make the IPC call
      const response = await window.electron.invoke(channel, ...args);

      // Check if response is an error
      if (isIPCError(response)) {
        setError(response.error);
        setData(null);
        return null;
      }

      // Success - set data
      setData(response as T);
      return response as T;
    } catch (err) {
      // Handle unexpected errors (e.g., network issues, renderer crashes)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setData(null);
      return null;
    } finally {
      // Always stop loading
      setIsLoading(false);
    }
  }, []);

  /**
   * Reset the state to initial values
   * 
   * Useful for clearing errors or data before a new operation
   */
  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    data,
    error,
    isLoading,
    invoke,
    reset,
  };
}

/**
 * Hook for a specific IPC channel with predefined types
 * 
 * This is a more specialized version that locks to a specific channel
 * 
 * @param channel - The IPC channel to use
 * @returns State object with data, error, isLoading, and call function
 * 
 * @example
 * function TestComponent() {
 *   const { data, error, isLoading, call } = useIPCChannel<TestMessageResponse>('test-message');
 * 
 *   const handleClick = () => {
 *     call({ message: 'Hello!' });
 *   };
 * 
 *   return (
 *     <div>
 *       <button onClick={handleClick}>Test</button>
 *       {data && <p>{data.reply}</p>}
 *     </div>
 *   );
 * }
 */
export function useIPCChannel<T = unknown>(channel: string) {
  const { data, error, isLoading, invoke, reset } = useIPCInvoke<T>();

  /**
   * Call the IPC channel with arguments
   */
  const call = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      return invoke(channel, ...args);
    },
    [channel, invoke]
  );

  return {
    data,
    error,
    isLoading,
    call,
    reset,
  };
}

