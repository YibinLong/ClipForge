import { IPCErrorResponse } from '../../types/ipc';
import { readTextFile } from './ipc';

/**
 * Convert SRT subtitle text to WebVTT format.
 * Minimal conversion: add WEBVTT header and replace comma decimal separators in timestamps.
 */
export function srtToVtt(srt: string): string {
  // Normalize newlines
  const normalized = srt.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Replace comma decimals in timestamps with dot (00:00:01,000 -> 00:00:01.000)
  const body = normalized.replace(/(\d\d:\d\d:\d\d),(\d{3})/g, '$1.$2');
  // Ensure a WEBVTT header
  return `WEBVTT\n\n${body}`;
}

/**
 * Load an SRT file via IPC, convert it to VTT, return an object URL for use in <track src>.
 */
export async function loadSrtAsVttUrl(srtPath: string): Promise<string | null> {
  const res = await readTextFile(srtPath);
  if ((res as IPCErrorResponse).success === false) return null;
  const content = (res as { success: true; content: string }).content;
  const vtt = srtToVtt(content);
  const blob = new Blob([vtt], { type: 'text/vtt' });
  return URL.createObjectURL(blob);
}



