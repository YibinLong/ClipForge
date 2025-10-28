/**
 * Test Message Handler - Ping/Pong IPC Test
 * 
 * WHY THIS EXISTS:
 * - Verifies that IPC infrastructure is working correctly
 * - Provides a simple example for implementing future handlers
 * - Tests the full round-trip: renderer → main → renderer
 * - Validates error handling and type safety
 * 
 * WHAT IT DOES:
 * - Accepts a message string from the renderer
 * - Validates the input (must be non-empty string)
 * - Returns an echo response with timestamp
 * - Demonstrates proper error handling
 */

import { IpcMainInvokeEvent } from 'electron';
import {
  TestMessageRequest,
  TestMessageResponse,
  IPCErrorResponse,
  IPCResult,
} from '../../types/ipc';

/**
 * Handle the test-message IPC call
 * 
 * This is a simple ping/pong handler that:
 * 1. Receives a message from the renderer
 * 2. Validates the message is a non-empty string
 * 3. Returns an echo response with timestamp
 * 
 * @param event - The IPC event (not used in this handler)
 * @param request - The request payload containing the message
 * @returns Response with echoed message and timestamp
 * 
 * @example
 * // From renderer:
 * const response = await window.electron.invoke('test-message', { message: 'Hello!' });
 * // response = { reply: 'Echo: Hello!', timestamp: 1234567890, success: true }
 */
export async function handleTestMessage(
  event: IpcMainInvokeEvent,
  request: unknown
): Promise<IPCResult<TestMessageResponse>> {
  // ===== INPUT VALIDATION =====
  // Always validate inputs to prevent errors and security issues
  
  // Check if request is an object
  if (!request || typeof request !== 'object') {
    const error: IPCErrorResponse = {
      success: false,
      error: 'Invalid request: expected an object',
      details: `Received type: ${typeof request}`,
    };
    return error;
  }

  // Type assertion after validation
  const { message } = request as TestMessageRequest;

  // Check if message exists and is a string
  if (typeof message !== 'string') {
    const error: IPCErrorResponse = {
      success: false,
      error: 'Invalid message: expected a string',
      details: `Received type: ${typeof message}`,
    };
    return error;
  }

  // Check if message is not empty
  if (message.trim().length === 0) {
    const error: IPCErrorResponse = {
      success: false,
      error: 'Message cannot be empty',
      details: 'Please provide a non-empty message string',
    };
    return error;
  }

  // ===== PROCESSING =====
  // Business logic goes here (in this case, just echoing)
  
  console.log(`[TEST_HANDLER] Processing message: "${message}"`);

  // Create the response
  const response: TestMessageResponse = {
    reply: `Echo: ${message}`,
    timestamp: Date.now(),
    success: true,
  };

  console.log(`[TEST_HANDLER] Sending response:`, response);

  return response;
}

