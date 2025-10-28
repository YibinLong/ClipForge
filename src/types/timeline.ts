/**
 * Timeline Types and Interfaces
 *
 * WHY THIS FILE EXISTS:
 * - Defines the data structures for timeline clips and state interactions
 * - Provides type safety for timeline-related operations across the app
 */

/**
 * TimelineClip
 *
 * Represents a clip placed on the timeline that references a source media item
 * from the media library by `mediaId`. Time values are in seconds.
 */
export interface TimelineClip {
  /** Unique identifier for the clip instance on the timeline */
  id: string;

  /** References MediaClip.id from the media library */
  mediaId: string;

  /** Track number where this clip resides (1 = main, 2 = overlay) */
  trackId: number;

  /** Absolute start time on the timeline in seconds */
  startTime: number;

  /** Absolute end time on the timeline in seconds (≥ startTime) */
  endTime: number;

  /** Trim start within the source media in seconds */
  trimStart: number;

  /** Trim end within the source media in seconds (≥ trimStart) */
  trimEnd: number;
}


