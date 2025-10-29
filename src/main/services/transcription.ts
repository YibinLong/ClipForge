import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { SubtitleData, SubtitleSegment } from '../../types/subtitles';

// Lazily initialize OpenAI client so dotenv (loaded in main/index.ts) can populate env first
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  return new OpenAI({ apiKey });
}

/**
 * Transcribe an audio file using OpenAI GPT-4o Transcribe.
 * Returns segments with start/end timestamps and text.
 */
export async function transcribeAudio(audioPath: string): Promise<SubtitleData> {
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  const client = getOpenAIClient();
  const preferredModel = process.env.TRANSCRIBE_MODEL || 'gpt-4o-transcribe';

  const tryTranscribeVerboseJson = async (model: string) => {
    // eslint-disable-next-line no-console
    console.log(`[TRANSCRIBE] Attempting model='${model}' with response_format='verbose_json'`);
    return client.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model,
      response_format: 'verbose_json',
    } as any);
  };

  let resp: any;
  try {
    resp = await tryTranscribeVerboseJson(preferredModel);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.warn('[TRANSCRIBE] Primary model failed:', msg);
    const isFormatIncompatible = /response_format\s+'verbose_json'\s+is\s+not\s+compatible/i.test(msg) || /400/.test(msg);
    const usedGpt4o = /gpt-4o-transcribe/i.test(preferredModel);
    if (isFormatIncompatible && usedGpt4o) {
      // Fallback to Whisper for timestamped segments
      const fallback = 'whisper-1';
      // eslint-disable-next-line no-console
      console.log(`[TRANSCRIBE] Falling back to model='${fallback}' with response_format='verbose_json'`);
      resp = await tryTranscribeVerboseJson(fallback);
    } else {
      throw e;
    }
  }

  // Map segments if available (verbose_json)
  const segments: SubtitleSegment[] = Array.isArray(resp?.segments)
    ? resp.segments.map((s: any) => ({
        start: Number(s.start) || 0,
        end: Number(s.end) || 0,
        text: String(s.text ?? ''),
      }))
    : [];

  if (segments.length === 0) {
    // Fallback: single segment using whole text if provided (no timing)
    const txt: string = resp?.text || '';
    if (txt.trim().length > 0) {
      // eslint-disable-next-line no-console
      console.warn('[TRANSCRIBE] No segments provided; returning single untimed segment');
      return { segments: [{ start: 0, end: 0, text: txt }] };
    }
  }

  return { segments };
}

/**
 * Convert seconds to SRT timestamp (HH:MM:SS,mmm)
 */
function toSrtTimestamp(sec: number): string {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mm = ms % 1000;
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(mm, 3)}`;
}

/**
 * Generate SRT file from segments to outputPath
 */
export async function generateSRTFile(data: SubtitleData, outputPath: string): Promise<void> {
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const lines: string[] = [];
  let idx = 1;
  for (const seg of data.segments) {
    const startTs = toSrtTimestamp(seg.start);
    const endTs = toSrtTimestamp(Math.max(seg.end, seg.start + 0.5));
    const text = (seg.text || '').trim();
    if (!text) continue;
    lines.push(String(idx++));
    lines.push(`${startTs} --> ${endTs}`);
    lines.push(text);
    lines.push('');
  }

  await fs.promises.writeFile(outputPath, lines.join('\n'), 'utf8');
}

/**
 * Filter and offset raw segments to a window [start,end] and subtract 'start'
 * Produces segments suitable for a trimmed clip that starts at 0.
 */
export function filterAndOffsetSegments(
  segments: SubtitleSegment[],
  start: number,
  end: number
): SubtitleSegment[] {
  const out: SubtitleSegment[] = [];
  for (const seg of segments) {
    const overlapStart = Math.max(start, seg.start);
    const overlapEnd = Math.min(end, seg.end);
    if (overlapEnd <= overlapStart) continue;
    out.push({
      start: overlapStart - start,
      end: overlapEnd - start,
      text: seg.text,
    });
  }
  return out;
}

/**
 * Utility to parse a basic SRT into segments (for export-time offsetting)
 */
export function parseSRT(srtContent: string): SubtitleSegment[] {
  const lines = srtContent.split(/\r?\n/);
  const segments: SubtitleSegment[] = [];
  let i = 0;
  while (i < lines.length) {
    // skip index line
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;
    i++;
    if (i >= lines.length) break;
    const timing = lines[i++];
    const m = timing.match(/(\d\d:\d\d:\d\d,\d\d\d)\s*-->\s*(\d\d:\d\d:\d\d,\d\d\d)/);
    if (!m) continue;
    const start = srtTimestampToSeconds(m[1]);
    const end = srtTimestampToSeconds(m[2]);
    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      textLines.push(lines[i++]);
    }
    segments.push({ start, end, text: textLines.join('\n') });
    while (i < lines.length && lines[i].trim() === '') i++;
  }
  return segments;
}

function srtTimestampToSeconds(ts: string): number {
  const m = ts.match(/(\d\d):(\d\d):(\d\d),(\d\d\d)/);
  if (!m) return 0;
  const h = Number(m[1]);
  const mn = Number(m[2]);
  const s = Number(m[3]);
  const ms = Number(m[4]);
  return h * 3600 + mn * 60 + s + ms / 1000;
}


