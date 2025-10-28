/**
 * Media Types and Interfaces
 * 
 * WHY THIS FILE EXISTS:
 * - Defines the data structure for imported video clips
 * - Provides type safety for media-related operations
 * - Central location for all media-related TypeScript interfaces
 * 
 * USAGE:
 * - Import MediaClip in both main and renderer processes
 * - Used by FFmpeg service to return metadata
 * - Used by media library state management
 */

/**
 * MediaClip Interface
 * 
 * Represents a video clip with all its metadata and thumbnail information.
 * Created when a user imports a video file via the import dialog or drag-and-drop.
 * 
 * FIELDS EXPLANATION:
 * - id: Unique identifier for the clip (timestamp-based for simplicity)
 * - filename: Just the filename (e.g., "my-video.mp4") without the full path
 * - path: Absolute file path to the original video file on disk
 * - duration: Video length in seconds (e.g., 125.5 for 2 minutes 5.5 seconds)
 * - width: Video resolution width in pixels (e.g., 1920)
 * - height: Video resolution height in pixels (e.g., 1080)
 * - size: File size in bytes (e.g., 15728640 for ~15 MB)
 * - thumbnail: Absolute path to the generated thumbnail PNG file
 * 
 * @example
 * const clip: MediaClip = {
 *   id: '1635789123456-abc123',
 *   filename: 'vacation-2023.mp4',
 *   path: '/Users/john/Videos/vacation-2023.mp4',
 *   duration: 182.5,
 *   width: 1920,
 *   height: 1080,
 *   size: 45678900,
 *   thumbnail: '/Users/john/Library/Application Support/ClipForge/thumbnails/1635789123456-abc123.png'
 * };
 */
export interface MediaClip {
  /** Unique identifier for this clip (timestamp + random string) */
  id: string;
  
  /** Filename without path (e.g., "video.mp4") */
  filename: string;
  
  /** Absolute path to the video file on disk */
  path: string;
  
  /** Duration in seconds (extracted from video metadata) */
  duration: number;
  
  /** Video width in pixels */
  width: number;
  
  /** Video height in pixels */
  height: number;
  
  /** File size in bytes */
  size: number;
  
  /** Absolute path to the thumbnail image file */
  thumbnail: string;
}

/**
 * Video Metadata (intermediate type used during extraction)
 * 
 * This is what FFmpeg returns before we have the thumbnail path.
 * Used internally by the FFmpeg service.
 */
export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  size: number;
}

