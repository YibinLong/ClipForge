import { IpcMainInvokeEvent, shell } from 'electron';
import { IPCErrorResponse, IPCResult, RevealInFolderRequest, RevealInFolderResponse } from '../../types/ipc';
import * as fs from 'fs';
import * as path from 'path';

export async function handleRevealInFolder(
  _event: IpcMainInvokeEvent,
  request: RevealInFolderRequest
): Promise<IPCResult<RevealInFolderResponse>> {
  try {
    const p = request?.path;
    if (!p || typeof p !== 'string') {
      const err: IPCErrorResponse = { success: false, error: 'Invalid path' };
      return err;
    }
    if (!path.isAbsolute(p)) {
      const err: IPCErrorResponse = { success: false, error: 'Path must be absolute' };
      return err;
    }
    if (!fs.existsSync(p)) {
      const err: IPCErrorResponse = { success: false, error: 'File not found' };
      return err;
    }
    shell.showItemInFolder(p);
    return { success: true };
  } catch (e) {
    const err: IPCErrorResponse = { success: false, error: 'Failed to reveal in folder', details: e instanceof Error ? e.message : String(e) };
    return err;
  }
}


