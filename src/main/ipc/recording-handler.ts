import { app, desktopCapturer, IpcMainInvokeEvent, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import {
  GetScreenSourcesResponse,
  GetScreenSourcesRequest,
  IPCErrorResponse,
  IPCResult,
  SaveRecordingFileRequest,
  SaveRecordingFileResponse,
  ScreenSource,
  SetCaptureSourceRequest,
  SetCaptureSourceResponse,
  TranscodeWebmToMp4Request,
  TranscodeWebmToMp4Response,
  ChooseRecordingOutputResponse,
  OpenRecordingsFolderResponse,
} from '../../types/ipc';
import { transcodeWebmToMp4 } from '../services/ffmpeg';

let selectedSourceId: string | null = null;

export function getSelectedSourceId(): string | null {
  return selectedSourceId;
}

function ensureRecordingsDirectory(): string {
  const dir = path.join(app.getPath('userData'), 'recordings');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function handleGetScreenSources(
  _event: IpcMainInvokeEvent,
  request?: GetScreenSourcesRequest
): Promise<IPCResult<GetScreenSourcesResponse>> {
  try {
    const includeWindows = !!request?.includeWindows;
    const sources = await desktopCapturer.getSources({
      types: includeWindows ? ['screen', 'window'] : ['screen'],
      thumbnailSize: { width: 320, height: 200 },
      fetchWindowIcons: true,
    });

    const mapped: ScreenSource[] = sources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnailDataUrl: s.thumbnail?.toDataURL() ?? '',
    }));

    return { success: true, sources: mapped };
  } catch (e) {
    const err: IPCErrorResponse = {
      success: false,
      error: 'Failed to get screen sources',
      details: e instanceof Error ? e.message : String(e),
    };
    return err;
  }
}

export async function handleSetCaptureSource(
  _event: IpcMainInvokeEvent,
  request: SetCaptureSourceRequest
): Promise<IPCResult<SetCaptureSourceResponse>> {
  try {
    if (!request || typeof request.sourceId !== 'string' || request.sourceId.length === 0) {
      const err: IPCErrorResponse = { success: false, error: 'Invalid sourceId' };
      return err;
    }
    selectedSourceId = request.sourceId;
    return { success: true };
  } catch (e) {
    const err: IPCErrorResponse = {
      success: false,
      error: 'Failed to set capture source',
      details: e instanceof Error ? e.message : String(e),
    };
    return err;
  }
}

export async function handleSaveRecordingFile(
  _event: IpcMainInvokeEvent,
  request: SaveRecordingFileRequest
): Promise<IPCResult<SaveRecordingFileResponse>> {
  try {
    if (!request || !(request.data instanceof ArrayBuffer)) {
      const err: IPCErrorResponse = { success: false, error: 'Invalid data: expected ArrayBuffer' };
      return err;
    }
    const dir = ensureRecordingsDirectory();
    const base = (request.filenameHint && request.filenameHint.trim().length > 0)
      ? request.filenameHint.replace(/\.(webm|mp4)$/i, '')
      : `recording-${Date.now()}`;
    const webmPath = path.join(dir, `${base}.webm`);

    const buf = Buffer.from(new Uint8Array(request.data));
    fs.writeFileSync(webmPath, buf);

    return { success: true, webmPath };
  } catch (e) {
    const err: IPCErrorResponse = {
      success: false,
      error: 'Failed to save recording file',
      details: e instanceof Error ? e.message : String(e),
    };
    return err;
  }
}

export async function handleTranscodeWebmToMp4(
  _event: IpcMainInvokeEvent,
  request: TranscodeWebmToMp4Request
): Promise<IPCResult<TranscodeWebmToMp4Response>> {
  try {
    if (!request || typeof request.inputPath !== 'string' || request.inputPath.length === 0) {
      const err: IPCErrorResponse = { success: false, error: 'Invalid inputPath' };
      return err;
    }
    const inPath = request.inputPath;
    const outPath = request.outputPath && request.outputPath.length > 0
      ? request.outputPath
      : path.join(path.dirname(inPath), `${path.basename(inPath, path.extname(inPath))}.mp4`);

    await transcodeWebmToMp4(inPath, outPath);

    return { success: true, mp4Path: outPath };
  } catch (e) {
    const err: IPCErrorResponse = {
      success: false,
      error: 'Failed to transcode recording',
      details: e instanceof Error ? e.message : String(e),
    };
    return err;
  }
}

export async function handleChooseRecordingOutput(
  _event: IpcMainInvokeEvent
): Promise<IPCResult<ChooseRecordingOutputResponse>> {
  try {
    const saveRes = await dialog.showSaveDialog({
      title: 'Save Recording As',
      defaultPath: 'screen-recording.mp4',
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    });
    if (saveRes.canceled || !saveRes.filePath) {
      const err: IPCErrorResponse = { success: false, error: 'User cancelled' };
      return err;
    }
    return { success: true, filePath: saveRes.filePath };
  } catch (e) {
    const err: IPCErrorResponse = { success: false, error: 'Failed to choose output', details: e instanceof Error ? e.message : String(e) };
    return err;
  }
}

export async function handleOpenRecordingsFolder(): Promise<IPCResult<OpenRecordingsFolderResponse>> {
  try {
    const dir = ensureRecordingsDirectory();
    await shell.openPath(dir);
    return { success: true };
  } catch (e) {
    const err: IPCErrorResponse = { success: false, error: 'Failed to open recordings folder', details: e instanceof Error ? e.message : String(e) };
    return err;
  }
}


