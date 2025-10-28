import ffmpeg from 'fluent-ffmpeg';
import './ffmpeg';

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


