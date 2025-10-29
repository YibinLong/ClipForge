import { IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { extractAudioToWav, ensureSubtitlesDirectory } from '../services/ffmpeg';
import { generateSRTFile, transcribeAudio } from '../services/transcription';
import {
  GenerateCaptionsRequest,
  GenerateCaptionsResponse,
  GenerateCaptionsProgressEvent,
  IPCResult,
  IPCErrorResponse,
  IPC_CHANNELS,
} from '../../types/ipc';

export async function handleGenerateCaptions(
  event: IpcMainInvokeEvent,
  req: GenerateCaptionsRequest
): Promise<IPCResult<GenerateCaptionsResponse>> {
  try {
    const { clipId, videoPath } = req || ({} as GenerateCaptionsRequest);
    if (!clipId || typeof clipId !== 'string') {
      const err: IPCErrorResponse = { success: false, error: 'Invalid clipId' };
      return err;
    }
    if (!videoPath || typeof videoPath !== 'string' || !fs.existsSync(videoPath)) {
      const err: IPCErrorResponse = { success: false, error: 'Invalid or missing videoPath' };
      return err;
    }

    const sendProgress = (e: GenerateCaptionsProgressEvent) => {
      event.sender.send(IPC_CHANNELS.GENERATE_CAPTIONS_PROGRESS, e);
    };

    // Ensure destination directories
    const subsDir = ensureSubtitlesDirectory();
    const tmpDir = path.join(subsDir, 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const tmpWav = path.join(tmpDir, `${clipId}-${Date.now()}.wav`);
    const outSrt = path.join(subsDir, `${clipId}.srt`);

    try {
      sendProgress({ clipId, phase: 'extracting_audio', message: 'Extracting audio...', progress: 5 });
      await extractAudioToWav(videoPath, tmpWav);

      sendProgress({ clipId, phase: 'transcribing', message: 'Transcribing audio...', progress: 50 });
      const data = await transcribeAudio(tmpWav);

      sendProgress({ clipId, phase: 'generating_srt', message: 'Generating SRT...', progress: 80 });
      await generateSRTFile(data, outSrt);

      // Cleanup temp wav
      try { 
        if (fs.existsSync(tmpWav)) {
          fs.unlinkSync(tmpWav);
        }
      } catch (err) {
        // Ignore cleanup errors
      }

      sendProgress({ clipId, phase: 'complete', message: 'Captions generated', progress: 100 });
      const ok: GenerateCaptionsResponse = { success: true, srtPath: outSrt };
      return ok;
    } catch (e) {
      try { 
        if (fs.existsSync(tmpWav)) {
          fs.unlinkSync(tmpWav);
        }
      } catch (err) {
        // Ignore cleanup errors
      }
      const msg = e instanceof Error ? e.message : String(e);
      sendProgress({ clipId, phase: 'error', errorMessage: msg });
      const err: IPCErrorResponse = { success: false, error: 'Caption generation failed', details: msg };
      return err;
    }
  } catch (e) {
    const err: IPCErrorResponse = { success: false, error: 'Internal error', details: e instanceof Error ? e.message : String(e) };
    return err;
  }
}


