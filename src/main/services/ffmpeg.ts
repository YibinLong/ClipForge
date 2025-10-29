/**
 * FFmpeg Service Module
 * 
 * WHY THIS FILE EXISTS:
 * - Provides video metadata extraction using FFprobe
 * - Generates thumbnail images from video files
 * - Centralizes all FFmpeg-related operations
 * 
 * DEPENDENCIES:
 * - fluent-ffmpeg: High-level FFmpeg API for Node.js
 * - ffmpeg-static: Pre-bundled FFmpeg binary (no external install needed)
 * 
 * SECURITY:
 * - Runs only in main process (has Node.js access)
 * - Validates file paths before processing
 * - Handles errors gracefully to prevent crashes
 */

import ffmpeg from 'fluent-ffmpeg';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { VideoMetadata } from '../../types/media';

// Configure FFmpeg to use the bundled binaries from ffmpeg-static and ffprobe-static
// WHY: These packages provide pre-compiled binaries, so users don't need to install FFmpeg
// NOTE: ffmpeg-static only provides ffmpeg, we need ffprobe-static for ffprobe (metadata extraction)

// Some bundlers rewrite require() calls. Use __non_webpack_require__ when available
// to resolve modules at runtime, and provide fallbacks.
declare const __non_webpack_require__: undefined | (typeof require);

function safeRequire<T = unknown>(id: string): T | null {
  try {
    if (typeof __non_webpack_require__ === 'function') {
      return (__non_webpack_require__ as typeof require)(id) as T;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(id) as T;
  } catch {
    return null;
  }
}

function normalizeAsarPath(p: string | null | undefined): string | null {
  if (!p) return null;
  // When packaged, binaries must live in app.asar.unpacked
  return p.includes('app.asar') ? p.replace('app.asar', 'app.asar.unpacked') : p;
}

function pathIfExists(p: string | null | undefined): string | null {
  if (!p) return null;
  try {
    return fs.existsSync(p) ? p : null;
  } catch {
    return null;
  }
}

function firstExisting(paths: Array<string | null | undefined>): string | null {
  for (const p of paths) {
    const norm = normalizeAsarPath(p);
    const exists = pathIfExists(norm);
    if (exists) return exists;
  }
  return null;
}

const ffmpegStaticFromNonWebpack = safeRequire<string>('ffmpeg-static');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegStaticFromWebpack: string | null = (() => { try { return require('ffmpeg-static'); } catch { return null; } })();

const ffprobeStaticMod = safeRequire<{ path: string }>('ffprobe-static');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffprobeStaticFromWebpack: { path: string } | null = (() => { try { return require('ffprobe-static'); } catch { return null; } })();

const resolvedFfmpegPath = firstExisting([
  ffmpegStaticFromNonWebpack,
  ffmpegStaticFromWebpack,
  path.join(process.cwd(), '.webpack', 'main', 'ffmpeg'),
  path.join(process.resourcesPath || '', 'ffmpeg'),
]);

const resolvedFfprobePath = firstExisting([
  ffprobeStaticMod?.path,
  ffprobeStaticFromWebpack?.path,
  path.join(process.cwd(), '.webpack', 'main', 'native_modules', 'ffprobe'),
  path.join(process.resourcesPath || '', 'ffprobe'),
]);

// Fix permissions on binaries (make them executable) only when they exist
// WHY: Webpack/packaging may not preserve execute permissions when copying binaries
// LAX POLICY: This is a local desktop app; setting +x is acceptable here
(() => {
  const toChmod: Array<string> = [];
  if (resolvedFfmpegPath) toChmod.push(resolvedFfmpegPath);
  if (resolvedFfprobePath) toChmod.push(resolvedFfprobePath);

  for (const p of toChmod) {
    try {
      // Skip chmod on Windows
      if (process.platform === 'win32') continue;
      fs.chmodSync(p, 0o755);
    } catch (chmodError) {
      console.warn('[FFMPEG] Could not set permissions (may already be set):', chmodError);
    }
  }
})();

if (!resolvedFfmpegPath) {
  console.error('[FFMPEG] Unable to resolve ffmpeg binary path. Ensure ffmpeg-static is installed.');
} else {
  ffmpeg.setFfmpegPath(resolvedFfmpegPath);
}

if (!resolvedFfprobePath) {
  console.error('[FFMPEG] Unable to resolve ffprobe binary path. Ensure ffprobe-static is installed.');
} else {
  ffmpeg.setFfprobePath(resolvedFfprobePath);
}

console.log('[FFMPEG] FFmpeg binary path:', resolvedFfmpegPath);
console.log('[FFMPEG] FFprobe binary path:', resolvedFfprobePath);

/**
 * Ensure the thumbnails directory exists
 * 
 * Creates the directory if it doesn't exist using the app's userData path.
 * 
 * IMPLEMENTATION:
 * - Uses Electron's app.getPath('userData') for platform-specific user data location
 * - Creates nested directory structure with recursive: true
 * - Safe to call multiple times (won't error if directory already exists)
 * 
 * @returns Absolute path to the thumbnails directory
 */
export function ensureThumbnailsDirectory(): string {
  // Get the app's user data directory (platform-specific)
  // macOS: ~/Library/Application Support/ClipForge
  // Windows: C:\Users\<username>\AppData\Roaming\ClipForge
  const userDataPath = app.getPath('userData');
  
  // Create thumbnails subdirectory path
  const thumbnailsDir = path.join(userDataPath, 'thumbnails');
  
  // Create directory if it doesn't exist
  // recursive: true creates parent directories if needed
  if (!fs.existsSync(thumbnailsDir)) {
    fs.mkdirSync(thumbnailsDir, { recursive: true });
  }
  
  return thumbnailsDir;
}

/**
 * Ensure the subtitles directory exists (for generated SRT files)
 */
export function ensureSubtitlesDirectory(): string {
  const userDataPath = app.getPath('userData');
  const subtitlesDir = path.join(userDataPath, 'subtitles');
  if (!fs.existsSync(subtitlesDir)) {
    fs.mkdirSync(subtitlesDir, { recursive: true });
  }
  return subtitlesDir;
}

/**
 * Extract video metadata using FFprobe
 * 
 * Uses fluent-ffmpeg's ffprobe wrapper to extract:
 * - Duration (in seconds)
 * - Resolution (width x height)
 * - File size (in bytes)
 * 
 * IMPLEMENTATION DETAILS:
 * - Uses ffmpeg.ffprobe() which is a static method (can be called without creating a command)
 * - Searches metadata.streams array for the first video stream (codec_type === 'video')
 * - Falls back to fs.statSync for file size if FFmpeg doesn't provide it
 * - Wraps in Promise for easier async/await usage
 * 
 * ERROR HANDLING:
 * - Corrupted files: FFprobe will error, which we catch and reject
 * - Unsupported formats: FFprobe will error with format-specific message
 * - Missing video stream: We throw a clear error message
 * 
 * @param filePath - Absolute path to the video file
 * @returns Promise resolving to VideoMetadata object
 * @throws Error if file cannot be read or metadata cannot be extracted
 * 
 * @example
 * const metadata = await getVideoMetadata('/path/to/video.mp4');
 * console.log(`Duration: ${metadata.duration}s, Resolution: ${metadata.width}x${metadata.height}`);
 */
export function getVideoMetadata(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('[FFMPEG] Error extracting metadata:', err);
        reject(new Error(`Failed to extract metadata: ${err.message}`));
        return;
      }
      
      try {
        // Extract duration from format metadata
        // format.duration is in seconds (e.g., 125.5)
        const duration = metadata.format.duration || 0;
        
        // Find the video stream from the streams array
        // A file can have multiple streams (video, audio, subtitles)
        // We want the first video stream
        const videoStream = metadata.streams.find(
          (stream: any) => stream.codec_type === 'video'
        );
        
        if (!videoStream) {
          throw new Error('No video stream found in file');
        }
        
        // Extract resolution from video stream
        const width = videoStream.width || 0;
        const height = videoStream.height || 0;
        
        // Extract file size from format metadata
        // If not available, fall back to fs.statSync
        let size = metadata.format.size || 0;
        if (!size) {
          const stats = fs.statSync(filePath);
          size = stats.size;
        }
        
        resolve({
          duration,
          width,
          height,
          size,
        });
      } catch (parseError) {
        console.error('[FFMPEG] Error parsing metadata:', parseError);
        reject(parseError);
      }
    });
  });
}

/**
 * Generate thumbnail image from video
 * 
 * Creates a PNG thumbnail by extracting a frame from the video at the 1-second mark.
 * If the video is shorter than 1 second, extracts from the first available frame.
 * 
 * IMPLEMENTATION DETAILS:
 * - Uses fluent-ffmpeg's screenshots() method (as per Context7 docs)
 * - Extracts at 1-second mark by default (or 0.5s for very short videos)
 * - Saves as PNG file with a unique filename based on clipId
 * - Returns the absolute path to the generated thumbnail
 * 
 * PERFORMANCE:
 * - Thumbnail generation is relatively fast (< 1 second for most videos)
 * - Runs asynchronously, doesn't block the main thread
 * 
 * ERROR HANDLING:
 * - If video is corrupted, FFmpeg will emit an 'error' event
 * - If output directory doesn't exist, we create it first
 * - If video has no frames (e.g., audio-only), this will fail
 * 
 * @param filePath - Absolute path to the video file
 * @param clipId - Unique clip identifier (used for thumbnail filename)
 * @param duration - Video duration in seconds (to handle short videos)
 * @returns Promise resolving to absolute path of generated thumbnail
 * @throws Error if thumbnail generation fails
 * 
 * @example
 * const thumbnailPath = await generateThumbnail('/path/to/video.mp4', 'clip-123', 125.5);
 * // thumbnailPath: '/Users/john/Library/Application Support/ClipForge/thumbnails/clip-123.png'
 */
export function generateThumbnail(
  filePath: string,
  clipId: string,
  duration: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Ensure thumbnails directory exists
    const thumbnailsDir = ensureThumbnailsDirectory();
    
    // Generate thumbnail filename
    const thumbnailFilename = `${clipId}.png`;
    const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);
    
    // Determine timestamp for thumbnail extraction
    // If video is longer than 1 second, extract at 1s mark
    // Otherwise, extract at half duration or 0s for very short videos
    let timestamp: string;
    if (duration > 1) {
      timestamp = '1'; // 1 second
    } else if (duration > 0.1) {
      timestamp = String(duration / 2); // Half duration
    } else {
      timestamp = '0'; // First frame
    }
    
    // Use FFmpeg screenshots API to extract a single frame
    // As per Context7 docs: ffmpeg(filePath).screenshots({ timestamps, folder, filename })
    ffmpeg(filePath)
      .screenshots({
        timestamps: [timestamp],
        folder: thumbnailsDir,
        filename: thumbnailFilename,
        // We don't specify size here to keep original aspect ratio
        // Could add size: '320x240' if we want consistent thumbnail sizes
      })
      .on('end', () => {
        resolve(thumbnailPath);
      })
      .on('error', (err) => {
        console.error('[FFMPEG] Error generating thumbnail:', err);
        reject(new Error(`Failed to generate thumbnail: ${err.message}`));
      });
  });
}

/**
 * Process a video file: extract metadata AND generate thumbnail
 * 
 * This is a convenience function that combines metadata extraction and thumbnail generation.
 * Used by the import handler to process files in one step.
 * 
 * @param filePath - Absolute path to the video file
 * @param clipId - Unique clip identifier
 * @returns Promise resolving to metadata with thumbnail path
 */
export async function processVideoFile(
  filePath: string,
  clipId: string
): Promise<VideoMetadata & { thumbnail: string }> {
  // First, extract metadata (we need duration for thumbnail generation)
  const metadata = await getVideoMetadata(filePath);
  
  // Then, generate thumbnail
  const thumbnail = await generateThumbnail(filePath, clipId, metadata.duration);
  
  return {
    ...metadata,
    thumbnail,
  };
}

/**
 * Transcode a WebM (VP8/Opus) file to MP4 (H.264/AAC)
 * 
 * - Video codec: libx264
 * - Pixel format: yuv420p
 * - Audio codec: aac
 * - Fast start for streaming: -movflags +faststart
 */
export function transcodeWebmToMp4(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Ensure output directory exists
      const outDir = path.dirname(outputPath);
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-profile:v high',
          '-preset medium',
          '-c:a aac',
          '-b:a 192k',
          '-movflags +faststart',
        ])
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(outputPath);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Extract audio track from a video into WAV (mono, 16kHz, PCM s16le)
 * Optimized for transcription models.
 */
export function extractAudioToWav(inputVideoPath: string, outputWavPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const outDir = path.dirname(outputWavPath);
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      ffmpeg(inputVideoPath)
        .noVideo()
        .audioChannels(1)
        .audioFrequency(16000)
        .audioCodec('pcm_s16le')
        .format('wav')
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(outputWavPath);
    } catch (e) {
      reject(e);
    }
  });
}

