import ffmpeg from 'fluent-ffmpeg';
import './ffmpeg';
import { MediaClip } from '../../types/media';
import { TimelineClip } from '../../types/timeline';

export function exportSingleClip(
  sourcePath: string,
  trimStartSec: number,
  trimEndSec: number,
  outputPath: string
): Promise<void> {
  const duration = Math.max(0, (trimEndSec || 0) - (trimStartSec || 0));
  if (!sourcePath || !outputPath) {
    return Promise.reject(new Error('Invalid parameters: sourcePath and outputPath are required'));
  }
  if (duration <= 0) {
    return Promise.reject(new Error('Invalid duration: trimEndSec must be greater than trimStartSec'));
  }

  return new Promise((resolve, reject) => {
    try {
      const cmd = ffmpeg(sourcePath)
        .setStartTime(trimStartSec)
        .setDuration(duration)
        .videoCodec('libx264')
        .audioCodec('aac')
        .format('mp4')
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
      cmd.run();
    } catch (e) {
      reject(e);
    }
  });
}


// ============================================================================
// Multi-clip export with optional Track 2 PiP overlay (Epics 5.2, 5.4)
// ============================================================================

export type ExportResolution = 'source' | '720p' | '1080p';

type ExportCallbacks = {
  onProgress?: (currentSeconds: number) => void;
  onStart?: (jobId: string) => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
  onCancel?: () => void;
};

export interface ExportTimelineOptions {
  timeline: TimelineClip[];
  media: MediaClip[];
  resolution: ExportResolution;
  outputPath: string;
}

let activeJob: { jobId: string; cmd: ffmpeg.FfmpegCommand; outputPath: string } | null = null;

export function cancelActiveExport(): void {
  if (activeJob?.cmd) {
    try {
      // Kill FFmpeg process
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (activeJob.cmd as any).kill('SIGKILL');
    } catch {
      // ignore
    }
  }
}

function parseTimemark(t: string | undefined): number {
  if (!t) return 0;
  // formats like 00:00:12.34
  const parts = t.split(':');
  if (parts.length !== 3) return 0;
  const [hh, mm, ss] = parts;
  const seconds = parseFloat(ss);
  return Number(hh) * 3600 + Number(mm) * 60 + (Number.isFinite(seconds) ? seconds : 0);
}

function f(num: number): string {
  return Number(num.toFixed(6)).toString();
}

function pickOverlayWidth(res: ExportResolution): number {
  switch (res) {
    case '1080p':
      return 480;
    case '720p':
      return 320;
    case 'source':
    default:
      return 320;
  }
}

/** Build FFmpeg inputs and filter graph for base-track concat + optional PiP overlay per segment */
function buildGraph(
  baseClips: TimelineClip[],
  overlayClips: TimelineClip[],
  media: MediaClip[],
  resolution: ExportResolution
): { inputs: string[]; filters: string[]; mapVideo: string; mapAudio: string; totalDuration: number } {
  // Deduplicate inputs by file path and map to input indices
  const uniquePaths: string[] = [];
  const pathToIndex = new Map<string, number>();
  const ensureInputIndex = (p: string): number => {
    const existing = pathToIndex.get(p);
    if (typeof existing === 'number') return existing;
    const idx = uniquePaths.length;
    uniquePaths.push(p);
    pathToIndex.set(p, idx);
    return idx;
  };

  // Ensure all referenced media paths are inputs
  for (const c of [...baseClips, ...overlayClips]) {
    const m = media.find((m0) => m0.id === c.mediaId);
    if (m) ensureInputIndex(m.path);
  }

  const filters: string[] = [];
  const concatInputs: string[] = [];
  let totalDuration = 0;
  const overlayW = pickOverlayWidth(resolution);

  // Determine working target dimensions for all segments BEFORE concat
  let targetW = 1280;
  let targetH = 720;
  if (resolution === '1080p') {
    targetW = 1920;
    targetH = 1080;
  } else if (resolution === '720p') {
    targetW = 1280;
    targetH = 720;
  } else {
    // source: take from first base clip's media if available
    const firstBase = baseClips[0] ? media.find((m) => m.id === baseClips[0].mediaId) : undefined;
    if (firstBase && firstBase.width && firstBase.height) {
      targetW = firstBase.width;
      targetH = firstBase.height;
    }
  }

  // Helper: find first overlay clip overlapping a window
  const findOverlayForWindow = (start: number, end: number): TimelineClip | null => {
    const candidates = overlayClips
      .filter((o) => o.endTime > start && o.startTime < end)
      .sort((a, b) => a.startTime - b.startTime);
    return candidates[0] ?? null;
  };

  baseClips.forEach((base, i) => {
    const baseMedia = media.find((m) => m.id === base.mediaId);
    if (!baseMedia) return;
    const baseIdx = ensureInputIndex(baseMedia.path);

    const dur = Math.max(0, base.trimEnd - base.trimStart);
    if (dur <= 0) return;
    totalDuration += dur;

    // Base trim (video/audio)
    const bv = `bv${i}`;
    const ba = `ba${i}`;
    filters.push(
      `[${baseIdx}:v]trim=start=${f(base.trimStart)}:end=${f(base.trimEnd)},setpts=PTS-STARTPTS[${bv}]`
    );
    // Normalize audio to common format for concat: 48k stereo fltp
    filters.push(
      `[${baseIdx}:a]atrim=start=${f(base.trimStart)}:end=${f(base.trimEnd)},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[${ba}]`
    );

    // Overlay if overlaps within base window
    let vOutLabel = `v${i}`;
    const ov = findOverlayForWindow(base.startTime, base.endTime);
    if (ov) {
      const ovMedia = media.find((m) => m.id === ov.mediaId);
      if (ovMedia) {
        const ovIdx = ensureInputIndex(ovMedia.path);
        // Compute overlap window relative to timeline
        const overlapStart = Math.max(base.startTime, ov.startTime);
        const overlapEnd = Math.min(base.endTime, ov.endTime);
        const overlapDur = Math.max(0, overlapEnd - overlapStart);
        if (overlapDur > 0) {
          // Overlay trim within overlay source
          const ovTrimStart = ov.trimStart + Math.max(0, overlapStart - ov.startTime);
          const ovTrimEnd = ovTrimStart + overlapDur;
          const ovLabel = `ov${i}`;
          filters.push(
            `[${ovIdx}:v]trim=start=${f(ovTrimStart)}:end=${f(ovTrimEnd)},setpts=PTS-STARTPTS,scale=${overlayW}:-2[${ovLabel}]`
          );
          filters.push(
            `[${bv}][${ovLabel}]overlay=x=main_w-w-20:y=main_h-h-20:shortest=1[${vOutLabel}]`
          );
        } else {
          // No effective overlap; passthrough base video
          vOutLabel = bv;
        }
      } else {
        // overlay media not found; passthrough base video
        vOutLabel = bv;
      }
    } else {
      // No overlay; passthrough base video
      vOutLabel = bv;
    }

    // Normalize video to target dimensions and pixel format; unify fps to 30
    const vs = `vs${i}`;
    filters.push(
      `[${vOutLabel}]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p,fps=30[${vs}]`
    );

    // Audio already normalized as [ba]
    const as = `as${i}`;
    filters.push(`[${ba}]anull[${as}]`);

    concatInputs.push(`[${vs}]`, `[${as}]`);
  });

  // Concat segments
  const n = concatInputs.length / 2;
  const vout = `vout`;
  const aout = `aout`;
  if (n > 0) {
    filters.push(`${concatInputs.join('')}concat=n=${n}:v=1:a=1[${vout}][${aout}]`);
  }

  // Final formatting (segments are already normalized); ensure yuv420p
  let mapVideo = `[${vout}]`;
  let mapAudio = `[${aout}]`;
  filters.push(`[${vout}]format=yuv420p[vf]`);
  mapVideo = `[vf]`;

  return { inputs: uniquePaths, filters, mapVideo, mapAudio, totalDuration };
}

export function exportTimelineWithOverlay(
  opts: ExportTimelineOptions,
  cbs: ExportCallbacks = {}
): Promise<void> {
  const { timeline, media, resolution, outputPath } = opts;
  const baseClips = [...timeline.filter((c) => c.trackId === 1)].sort((a, b) => a.startTime - b.startTime);
  const overlayClips = [...timeline.filter((c) => c.trackId === 2)].sort((a, b) => a.startTime - b.startTime);

  if (!baseClips.length) return Promise.reject(new Error('Timeline has no clips on Track 1'));

  const { inputs, filters, mapVideo, mapAudio, totalDuration } = buildGraph(baseClips, overlayClips, media, resolution);

  return new Promise((resolve, reject) => {
    try {
      const jobId = `export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const cmd = ffmpeg();
      inputs.forEach((p) => cmd.input(p));
      // Debug: log inputs and filter graph
      console.log('[FFMPEG][inputs]', inputs);
      console.log('[FFMPEG][filters]', filters.join(';'));

      cmd
        .complexFilter(filters, [mapVideo, mapAudio])
        .outputOptions(['-movflags', '+faststart'])
        .videoCodec('libx264')
        .audioCodec('aac')
        .format('mp4')
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('[FFMPEG][start]', commandLine);
          activeJob = { jobId, cmd, outputPath };
          if (cbs.onStart) cbs.onStart(jobId);
        })
        .on('stderr', (line) => {
          console.log('[FFMPEG][stderr]', line);
        })
        .on('progress', (p) => {
          const seconds = parseTimemark((p as unknown as { timemark?: string }).timemark);
          if (cbs.onProgress) cbs.onProgress(seconds);
        })
        .on('end', () => {
          if (cbs.onEnd) cbs.onEnd();
          activeJob = null;
          resolve();
        })
        .on('error', (err) => {
          // Detect cancel vs error
          const msg = String(err?.message || err);
          if (/SIGKILL|signal/i.test(msg)) {
            if (cbs.onCancel) cbs.onCancel();
            activeJob = null;
            // Delete partial file best-effort
            try { require('fs').existsSync(outputPath) && require('fs').unlinkSync(outputPath); } catch {}
            reject(new Error('Export cancelled'));
            return;
          }
          if (cbs.onError) cbs.onError(err);
          activeJob = null;
          reject(err);
        });

      // Kick off
      cmd.run();
    } catch (e) {
      reject(e as Error);
    }
  });
}


