import { create } from 'zustand';
import { TimelineClip } from '../../types/timeline';

interface TimelineState {
  clips: TimelineClip[];
  playheadPosition: number; // seconds
  zoomLevel: number; // 1..10
  selectedClipId: string | null;

  addClipToTimeline: (clip: TimelineClip) => void;
  removeClipFromTimeline: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  setPlayheadPosition: (time: number) => void;
  setZoomLevel: (level: number) => void;
  selectTimelineClip: (clipId: string | null) => void;
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  clips: [],
  playheadPosition: 0,
  zoomLevel: 1,
  selectedClipId: null,

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
    set({ playheadPosition: clamped });
  },

  setZoomLevel: (level) => {
    const clamped = Math.max(1, Math.min(10, level));
    set({ zoomLevel: clamped });
  },

  selectTimelineClip: (clipId) => set({ selectedClipId: clipId }),
}));


