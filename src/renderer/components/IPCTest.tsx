/**
 * IPC Test Component
 * 
 * WHY THIS EXISTS:
 * - Tests the IPC infrastructure (renderer → main → renderer)
 * - Demonstrates how to use IPC hooks in a React component
 * - Provides visual feedback for IPC call results
 * - Helps verify that the entire communication pipeline works
 * 
 * WHAT IT DOES:
 * - Provides an input field for entering test messages
 * - Shows a button to trigger the IPC call
 * - Displays loading state while waiting for response
 * - Shows the response or error message
 * - Demonstrates proper error handling
 */

import React, { useState } from 'react';
import { useIPCInvoke } from '../hooks/useIPC';
import { TestMessageResponse } from '../../types/ipc';
import { testMessage } from '../utils/ipc';

/**
 * IPCTest Component
 * 
 * This component provides a UI for testing the test-message IPC handler
 * It demonstrates the full IPC flow: user input → renderer → main → response → UI update
 */
export const IPCTest: React.FC = () => {
  // State for the input message
  const [message, setMessage] = useState('');
  
  // State for tracking responses (using direct function call approach)
  const [response, setResponse] = useState<TestMessageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // State for tracking round-trip time
  // This records when we SEND the request, so we can calculate the full round-trip duration
  const [requestStartTime, setRequestStartTime] = useState<number | null>(null);
  const [roundTripTime, setRoundTripTime] = useState<number | null>(null);

  /**
   * Handle sending test message
   * 
   * This function:
   * 1. Validates the input
   * 2. Calls the IPC function
   * 3. Handles the response or error
   * 4. Updates the UI state
   */
  const handleSendMessage = async () => {
    // Clear previous results
    setResponse(null);
    setError(null);
    setRoundTripTime(null);

    // Validate input
    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    // Set loading state
    setIsLoading(true);

    // ===== CAPTURE START TIME =====
    // Record when we START the IPC call (before await)
    // This is the beginning of the round-trip journey
    const startTime = Date.now();
    setRequestStartTime(startTime);

    try {
      // Call the IPC function (from utils/ipc.ts)
      const result = await testMessage(message);

      // ===== CAPTURE END TIME =====
      // Record when we RECEIVE the response (after await)
      // This is the end of the round-trip journey
      const endTime = Date.now();
      const duration = endTime - startTime;
      setRoundTripTime(duration);

      // Check if result is an error
      if ('success' in result && result.success === false) {
        setError(result.error);
        setResponse(null);
      } else {
        setResponse(result as TestMessageResponse);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setResponse(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle key press in input field
   * Allow Enter key to submit
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSendMessage();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg border-2 border-purple-200">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          🔗 IPC Test Console
        </h2>
        <p className="text-sm text-gray-600">
          Test the Inter-Process Communication between renderer and main process
        </p>
      </div>

      {/* Input Section */}
      <div className="mb-4">
        <label htmlFor="message-input" className="block text-sm font-medium text-gray-700 mb-2">
          Test Message
        </label>
        <input
          id="message-input"
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter a message to send to main process..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
          disabled={isLoading}
        />
      </div>

      {/* Send Button */}
      <button
        onClick={handleSendMessage}
        disabled={isLoading || !message.trim()}
        className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all ${
          isLoading || !message.trim()
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-purple-600 hover:bg-purple-700 active:scale-95'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Sending...
          </span>
        ) : (
          '📤 Send Test Message'
        )}
      </button>

      {/* Response Section */}
      {(response || error) && (
        <div className="mt-6">
          {/* Success Response */}
          {response && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">✅</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-green-800 mb-2">
                    IPC Call Successful
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-2">
                      <span className="font-medium text-green-700">Reply:</span>
                      <span className="text-green-900">{response.reply}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-medium text-green-700">Timestamp:</span>
                      <span className="text-green-900">
                        {new Date(response.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {roundTripTime !== null && (
                      <div className="flex gap-2">
                        <span className="font-medium text-green-700">Round-trip time:</span>
                        <span className="text-green-900">
                          {roundTripTime}ms
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Response */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">❌</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-800 mb-2">
                    IPC Call Failed
                  </h3>
                  <p className="text-sm text-red-900">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Section */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2 text-sm">
          ℹ️ How IPC Works
        </h4>
        <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
          <li>Renderer process (React) sends message via window.electron.invoke()</li>
          <li>Preload script (contextBridge) securely forwards to main process</li>
          <li>Main process handler validates input and processes request</li>
          <li>Main process returns response (success or error)</li>
          <li>Renderer receives response and updates UI</li>
        </ol>
      </div>
    </div>
  );
};

export default IPCTest;

