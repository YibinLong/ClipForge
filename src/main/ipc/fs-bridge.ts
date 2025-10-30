import { IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { IPCErrorResponse, IPCResult, ReadTextFileRequest, ReadTextFileResponse } from '../../types/ipc';

/**
 * Read a text file from disk and return its contents.
 * Used by the renderer to safely load captions (SRT) which are then converted to VTT.
 */
export async function handleReadTextFile(
  _event: IpcMainInvokeEvent,
  request: ReadTextFileRequest
): Promise<IPCResult<ReadTextFileResponse>> {
  try {
    const filePath = request?.path;
    const encoding = (request?.encoding || 'utf8') as BufferEncoding;

    if (!filePath || typeof filePath !== 'string') {
      const err: IPCErrorResponse = { success: false, error: 'Invalid or missing path' };
      return err;
    }

    // Basic sanity checks
    if (!path.isAbsolute(filePath)) {
      const err: IPCErrorResponse = { success: false, error: 'Path must be absolute' };
      return err;
    }
    if (!fs.existsSync(filePath)) {
      const err: IPCErrorResponse = { success: false, error: 'File does not exist' };
      return err;
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      const err: IPCErrorResponse = { success: false, error: 'Path is not a file' };
      return err;
    }

    // Read file
    const data = await fs.promises.readFile(filePath, { encoding });
    const ok: ReadTextFileResponse = { success: true, content: data };
    return ok;
  } catch (e) {
    const err: IPCErrorResponse = {
      success: false,
      error: 'Failed to read file',
      details: e instanceof Error ? e.message : String(e),
    };
    return err;
  }
}



