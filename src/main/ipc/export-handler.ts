import { IpcMainInvokeEvent, dialog } from 'electron';
import * as path from 'path';
import { exportSingleClip } from '../services/export';
import {
  StartExportTimelineRequest,
  StartExportResponse,
  IPCErrorResponse,
  IPCResult,
} from '../../types/ipc';

export async function handleStartExport(
  _event: IpcMainInvokeEvent,
  request: unknown
): Promise<IPCResult<StartExportResponse>> {
  if (!request || typeof request !== 'object') {
    const err: IPCErrorResponse = {
      success: false,
      error: 'Invalid request: expected an object',
    };
    return err;
  }

  const { timeline, media, trackId, suggestedName } = request as StartExportTimelineRequest;
  if (!Array.isArray(timeline) || !Array.isArray(media)) {
    const err: IPCErrorResponse = {
      success: false,
      error: 'Invalid request payload: timeline and media arrays are required',
    };
    return err;
  }

  const targetTrackId = typeof trackId === 'number' ? trackId : 1;
  const clipsOnTrack = timeline.filter((c) => c.trackId === targetTrackId);

  if (clipsOnTrack.length === 0) {
    const err: IPCErrorResponse = {
      success: false,
      error: 'Timeline is empty on the selected track',
    };
    return err;
  }

  if (clipsOnTrack.length > 1) {
    const err: IPCErrorResponse = {
      success: false,
      error: 'Multiple clips on Track 1 are not supported in Epic 5.1. Use Epic 5.2.',
    };
    return err;
  }

  const clip = clipsOnTrack[0];
  const source = media.find((m) => m.id === clip.mediaId) || null;
  if (!source) {
    const err: IPCErrorResponse = {
      success: false,
      error: 'Source media not found for selected timeline clip',
    };
    return err;
  }

  const baseName = (suggestedName ? suggestedName : (path.parse(source.filename).name + '-export')).replace(/\.mp4$/i, '');

  const saveRes = await dialog.showSaveDialog({
    title: 'Export MP4',
    defaultPath: `${baseName}.mp4`,
    filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
  });

  if (saveRes.canceled || !saveRes.filePath) {
    const err: IPCErrorResponse = {
      success: false,
      error: 'User cancelled',
    };
    return err;
  }

  try {
    await exportSingleClip(source.path, clip.trimStart, clip.trimEnd, saveRes.filePath);
    const ok: StartExportResponse = {
      success: true,
      outputPath: saveRes.filePath,
    };
    return ok;
  } catch (e) {
    const err: IPCErrorResponse = {
      success: false,
      error: 'FFmpeg export failed',
      details: e instanceof Error ? e.message : String(e),
    };
    return err;
  }
}


