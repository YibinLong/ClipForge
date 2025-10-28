import { create } from 'zustand';
import { TimelineClip } from '../../types/timeline';

const MIN_CLIP_DURATION = 0.1;
const EPSILON = 1e-6;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const sortTrackClips = (clips: TimelineClip[], trackId: number) =>
  [...clips.filter((clip) => clip.trackId === trackId)].sort((a, b) => {
    if (a.startTime === b.startTime) {
      return a.id.localeCompare(b.id);
    }
    return a.startTime - b.startTime;
  });

const reflowTrackFrom = (clips: TimelineClip[], trackId: number, startClipId?: string): TimelineClip[] => {
  const sorted = sortTrackClips(clips, trackId);
  if (!sorted.length) return clips;

  const startIndex = startClipId ? sorted.findIndex((clip) => clip.id === startClipId) : 0;
  if (startIndex === -1) return clips;

  let cursor = startIndex > 0 ? sorted[startIndex - 1].endTime : 0;
  const updates = new Map<string, { startTime: number; endTime: number }>();

  for (let i = startIndex; i < sorted.length; i += 1) {
    const clip = sorted[i];
    const duration = Math.max(MIN_CLIP_DURATION, clip.trimEnd - clip.trimStart);
    const startTime = cursor;
    const endTime = startTime + duration;
    cursor = endTime;
    updates.set(clip.id, { startTime, endTime });
  }

  return clips.map((clip) => {
    const patch = updates.get(clip.id);
    return patch ? { ...clip, ...patch } : clip;
  });
};

const computeTimelineEnd = (clips: TimelineClip[]) =>
  clips.reduce((max, clip) => (clip.endTime > max ? clip.endTime : max), 0);

interface TimelineState {
  clips: TimelineClip[];
  playheadPosition: number;
  zoomLevel: number;
  selectedClipId: string | null;
  isPlaying: boolean;
  currentTime: number;

  addClipToTimeline: (clip: TimelineClip) => void;
  removeClipFromTimeline: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  setPlayheadPosition: (time: number) => void;
  setZoomLevel: (level: number) => void;
  selectTimelineClip: (clipId: string | null) => void;
  play: () => void;
  pause: () => void;
  setCurrentTime: (time: number) => void;
  getTimelineEnd: () => number;
  rippleTrimStart: (clipId: string, targetTrimStart: number, mediaDuration?: number | null) => void;
  rippleTrimEnd: (clipId: string, targetTrimEnd: number, mediaDuration?: number | null) => void;
  splitClip: (clipId: string, splitTime: number) => void;
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  clips: [],
  playheadPosition: 0,
  zoomLevel: 1,
  selectedClipId: null,
  isPlaying: false,
  currentTime: 0,

  addClipToTimeline: (clip) => {
    set((state) => ({ clips: [...state.clips, clip] }));
  },

  removeClipFromTimeline: (clipId) => {
    set((state) => ({ clips: state.clips.filter((c) => c.id !== clipId) }));
  },

  updateClip: (clipId, updates) => {
    set((state) => ({
      clips: state.clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c)),
    }));
  },

  setPlayheadPosition: (time) => {
    const clamped = Math.max(0, time);
    set({ playheadPosition: clamped, currentTime: clamped });
  },

  setZoomLevel: (level) => {
    const clamped = Math.max(1, Math.min(10, level));
    set({ zoomLevel: clamped });
  },

  selectTimelineClip: (clipId) => set({ selectedClipId: clipId }),

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  setCurrentTime: (time) => {
    const clamped = Math.max(0, time);
    set({ currentTime: clamped, playheadPosition: clamped });
  },
  getTimelineEnd: () => {
    const clips = get().clips;
    if (!clips.length) return 0;
    return computeTimelineEnd(clips);
  },
  rippleTrimStart: (clipId, targetTrimStart, mediaDuration) => {
    set((state) => {
      const clipIndex = state.clips.findIndex((clip) => clip.id === clipId);
      if (clipIndex === -1) return state;

      const clip = state.clips[clipIndex];
      const maxByClip = clip.trimEnd - MIN_CLIP_DURATION;
      const maxByMedia =
        typeof mediaDuration === 'number' ? mediaDuration - MIN_CLIP_DURATION : maxByClip;
      const maxTrimStart = Math.max(0, Math.min(maxByClip, maxByMedia));
      const desired = clamp(targetTrimStart, 0, maxTrimStart);

      console.log('[STORE][rippleTrimStart] Input:', {
        clipId,
        targetTrimStart,
        mediaDuration,
        currentClip: {
          startTime: clip.startTime,
          endTime: clip.endTime,
          trimStart: clip.trimStart,
          trimEnd: clip.trimEnd,
          duration: clip.endTime - clip.startTime,
        },
        constraints: { maxByClip, maxByMedia, maxTrimStart, desired },
      });

      let actualTrimStart = desired;

      if (desired < clip.trimStart - EPSILON) {
        const restoreAmount = clip.trimStart - desired;
        const trackClips = sortTrackClips(state.clips, clip.trackId);
        const currentIndex = trackClips.findIndex((c) => c.id === clipId);
        const prevClip = currentIndex > 0 ? trackClips[currentIndex - 1] : null;
        const prevEnd = prevClip ? prevClip.endTime : 0;
        const availableGap = clip.startTime - prevEnd;
        const allowableRestore = Math.min(restoreAmount, availableGap);
        actualTrimStart = clip.trimStart - allowableRestore;
      } else if (desired > clip.trimStart + EPSILON) {
        actualTrimStart = desired;
      }

      if (Math.abs(actualTrimStart - clip.trimStart) < EPSILON) {
        console.log('[STORE][rippleTrimStart] No change (within epsilon), skipping update');
        return state;
      }

      const added = clip.trimStart - actualTrimStart;
      const newDuration = Math.max(MIN_CLIP_DURATION, clip.trimEnd - actualTrimStart);
      const newStartTime = Math.max(0, clip.startTime - Math.max(0, added));

      console.log('[STORE][rippleTrimStart] Applying update:', {
        actualTrimStart,
        calculation: { added, newDuration, newStartTime: clip.endTime - newDuration },
        updatedClip: {
          trimStart: actualTrimStart,
          startTime: clip.endTime - newDuration,
          endTime: clip.endTime,
          visualWidth: newDuration,
          note: 'LEFT TRIM: Right edge stays fixed, left edge moves',
        },
      });

      // LEFT TRIM: Keep endTime fixed, adjust startTime so right edge stays in place
      const updatedClip: TimelineClip = {
        ...clip,
        trimStart: actualTrimStart,
        startTime: clip.endTime - newDuration, // Move start so end stays fixed
        endTime: clip.endTime, // Keep right edge in place
      };

      let updatedClips = [...state.clips];
      updatedClips[clipIndex] = updatedClip;
      // Don't reflow - we want simple trim, not ripple editing

      console.log('[STORE][rippleTrimStart] Final state:', {
        before: { start: clip.startTime, end: clip.endTime, trimStart: clip.trimStart, trimEnd: clip.trimEnd },
        after: { start: updatedClip.startTime, end: updatedClip.endTime, trimStart: updatedClip.trimStart, trimEnd: updatedClip.trimEnd },
      });

      const timelineEnd = computeTimelineEnd(updatedClips);
      const playheadPosition = Math.min(state.playheadPosition, timelineEnd);
      const currentTime = Math.min(state.currentTime, timelineEnd);

      return {
        clips: updatedClips,
        playheadPosition,
        currentTime,
      };
    });
  },
  rippleTrimEnd: (clipId, targetTrimEnd, mediaDuration) => {
    set((state) => {
      const clipIndex = state.clips.findIndex((clip) => clip.id === clipId);
      if (clipIndex === -1) return state;

      const clip = state.clips[clipIndex];
      const minTrimEnd = clip.trimStart + MIN_CLIP_DURATION;
      // When mediaDuration is not provided, allow extending beyond current trimEnd
      // Use a large upper bound (1 hour) instead of capping at current trimEnd
      const mediaCap = typeof mediaDuration === 'number' ? mediaDuration : 3600;
      const maxTrimEnd = Math.max(minTrimEnd, mediaCap);
      const desired = clamp(targetTrimEnd, minTrimEnd, maxTrimEnd);

      console.log('[STORE][rippleTrimEnd] Input:', {
        clipId,
        targetTrimEnd,
        mediaDuration,
        currentClip: {
          startTime: clip.startTime,
          endTime: clip.endTime,
          trimStart: clip.trimStart,
          trimEnd: clip.trimEnd,
          duration: clip.endTime - clip.startTime,
        },
        constraints: { minTrimEnd, mediaCap, maxTrimEnd, desired },
      });

      let actualTrimEnd = desired;

      if (desired > clip.trimEnd + EPSILON) {
        const extendAmount = desired - clip.trimEnd;
        const trackClips = sortTrackClips(state.clips, clip.trackId);
        const currentIndex = trackClips.findIndex((c) => c.id === clipId);
        const nextClip =
          currentIndex >= 0 && currentIndex < trackClips.length - 1
            ? trackClips[currentIndex + 1]
            : null;
        const availableGap = nextClip ? Math.max(0, nextClip.startTime - clip.endTime) : extendAmount;
        const allowableExtend = Math.min(extendAmount, availableGap);
        actualTrimEnd = clip.trimEnd + allowableExtend;
      } else if (desired < clip.trimEnd - EPSILON) {
        actualTrimEnd = desired;
      }

      if (Math.abs(actualTrimEnd - clip.trimEnd) < EPSILON) {
        console.log('[STORE][rippleTrimEnd] No change (within epsilon), skipping update');
        return state;
      }

      const newDuration = Math.max(MIN_CLIP_DURATION, actualTrimEnd - clip.trimStart);
      
      console.log('[STORE][rippleTrimEnd] Applying update:', {
        actualTrimEnd,
        calculation: { newDuration, newEndTime: clip.startTime + newDuration },
        updatedClip: {
          trimEnd: actualTrimEnd,
          startTime: clip.startTime,
          endTime: clip.startTime + newDuration,
          visualWidth: newDuration,
        },
      });

      const updatedClip: TimelineClip = {
        ...clip,
        trimEnd: actualTrimEnd,
        startTime: clip.startTime, // Keep position fixed - simple trim, not ripple
        endTime: clip.startTime + newDuration, // Update end based on trimmed duration
      };

      let updatedClips = [...state.clips];
      updatedClips[clipIndex] = updatedClip;
      // Don't reflow - we want simple trim, not ripple editing

      console.log('[STORE][rippleTrimEnd] Final state:', {
        before: { start: clip.startTime, end: clip.endTime, trimStart: clip.trimStart, trimEnd: clip.trimEnd },
        after: { start: updatedClip.startTime, end: updatedClip.endTime, trimStart: updatedClip.trimStart, trimEnd: updatedClip.trimEnd },
      });

      const timelineEnd = computeTimelineEnd(updatedClips);
      const playheadPosition = Math.min(state.playheadPosition, timelineEnd);
      const currentTime = Math.min(state.currentTime, timelineEnd);

      return {
        clips: updatedClips,
        playheadPosition,
        currentTime,
      };
    });
  },
  splitClip: (clipId, splitTime) => {
    set((state) => {
      const idx = state.clips.findIndex((c) => c.id === clipId);
      if (idx === -1) return state;

      const clip = state.clips[idx];
      // Validate split time strictly inside clip bounds and respect minimum duration on both sides
      const leftDuration = splitTime - clip.startTime;
      const rightDuration = clip.endTime - splitTime;

      if (
        leftDuration < MIN_CLIP_DURATION ||
        rightDuration < MIN_CLIP_DURATION
      ) {
        return state;
      }

      // Preserve trims across the split. Invariants: (end - start) === (trimEnd - trimStart)
      const leftClip: TimelineClip = {
        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mediaId: clip.mediaId,
        trackId: clip.trackId,
        startTime: clip.startTime,
        endTime: splitTime,
        trimStart: clip.trimStart,
        trimEnd: clip.trimStart + leftDuration,
      };

      const rightClip: TimelineClip = {
        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mediaId: clip.mediaId,
        trackId: clip.trackId,
        startTime: splitTime,
        endTime: clip.endTime,
        trimStart: clip.trimStart + leftDuration,
        trimEnd: clip.trimEnd,
      };

      const nextClips = [...state.clips];
      // Replace original with two clips in-place
      nextClips.splice(idx, 1, leftClip, rightClip);

      const timelineEnd = computeTimelineEnd(nextClips);
      const playheadPosition = Math.min(state.playheadPosition, timelineEnd);
      const currentTime = Math.min(state.currentTime, timelineEnd);

      return {
        clips: nextClips,
        playheadPosition,
        currentTime,
      };
    });
  },
}));
