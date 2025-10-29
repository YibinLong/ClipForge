/**
 * Subtitle types for AI-generated captions
 */

export interface SubtitleSegment {
  /** start time in seconds */
  start: number;
  /** end time in seconds */
  end: number;
  /** transcript text */
  text: string;
}

export interface SubtitleData {
  /** ordered list of segments */
  segments: SubtitleSegment[];
  /** optional language code (e.g., 'en') */
  language?: string;
}


