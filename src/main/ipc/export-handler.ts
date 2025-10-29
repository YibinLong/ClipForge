import { IpcMainInvokeEvent, dialog } from 'electron';
import { exportTimelineWithOverlay, cancelActiveExport } from '../services/export';
import {
  StartExportTimelineRequest,
  StartExportResponse,
  IPCErrorResponse,
  IPCResult,
  ExportProgressEvent,
  IPC_CHANNELS,
} from '../../types/ipc';

export async function handleStartExport(
  event: IpcMainInvokeEvent,
  request: unknown
): Promise<IPCResult<StartExportResponse>> {
  if (!request || typeof request !== 'object') {
    const err: IPCErrorResponse = {
      success: false,
      error: 'Invalid request: expected an object',
    };
    return err;
  }

  const { timeline, media, trackId, suggestedName, resolution, enableSubtitles } = request as StartExportTimelineRequest;
  if (!Array.isArray(timeline) || !Array.isArray(media)) {
    const err: IPCErrorResponse = {
      success: false,
      error: 'Invalid request payload: timeline and media arrays are required',
    };
    return err;
  }

  const baseName = (suggestedName ? suggestedName : 'timeline-export').replace(/\.mp4$/i, '');

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

  const jobId = `export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const totalDuration = timeline
      .filter((c) => (typeof trackId === 'number' ? c.trackId === trackId : c.trackId === 1))
      .reduce((acc, c) => acc + Math.max(0, (c.trimEnd || 0) - (c.trimStart || 0)), 0);

    await exportTimelineWithOverlay(
      {
        timeline,
        media,
        resolution: resolution ?? 'source',
        outputPath: saveRes.filePath,
        enableSubtitles: !!enableSubtitles,
      },
      {
        onStart: () => {
          const ev: ExportProgressEvent = {
            jobId,
            percent: 0,
            currentSeconds: 0,
            status: 'processing',
          };
          event.sender.send(IPC_CHANNELS.EXPORT_PROGRESS, ev);
        },
        onProgress: (seconds) => {
          const percent = totalDuration > 0 ? Math.min(100, (seconds / totalDuration) * 100) : 0;
          const remaining = totalDuration > 0 ? Math.max(0, totalDuration - seconds) : undefined;
          const ev: ExportProgressEvent = {
            jobId,
            percent,
            currentSeconds: seconds,
            etaSeconds: remaining,
            status: 'processing',
          };
          event.sender.send(IPC_CHANNELS.EXPORT_PROGRESS, ev);
        },
        onEnd: () => {
          const ev: ExportProgressEvent = {
            jobId,
            percent: 100,
            currentSeconds: totalDuration,
            status: 'complete',
          };
          event.sender.send(IPC_CHANNELS.EXPORT_PROGRESS, ev);
        },
        onError: (err) => {
          const ev: ExportProgressEvent = {
            jobId,
            percent: 0,
            currentSeconds: 0,
            status: 'error',
            errorMessage: err.message,
          };
          event.sender.send(IPC_CHANNELS.EXPORT_PROGRESS, ev);
        },
        onCancel: () => {
          const ev: ExportProgressEvent = {
            jobId,
            percent: 0,
            currentSeconds: 0,
            status: 'cancelled',
          };
          event.sender.send(IPC_CHANNELS.EXPORT_PROGRESS, ev);
        },
      }
    );

    const ok: StartExportResponse = {
      success: true,
      outputPath: saveRes.filePath,
      jobId,
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

export async function handleCancelExport(): Promise<{ success: true }> {
  cancelActiveExport();
  return { success: true };
}


