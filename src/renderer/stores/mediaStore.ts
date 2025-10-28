import { create } from 'zustand';
import { MediaClip } from '../../types/media';
import { loadMediaLibrary, saveMediaLibrary } from '../utils/ipc';

type MediaState = {
  clips: MediaClip[];
  selectedClipId: string | null;
  addClip: (clip: MediaClip) => void;
  addClips: (clips: MediaClip[]) => void;
  removeClip: (clipId: string) => void;
  clearAll: () => void;
  selectClip: (clipId: string | null) => void;
  initializeFromSaved: () => Promise<void>;
};

// Debounced save helper scoped to this module
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 500;
function scheduleSave(getClips: () => MediaClip[]): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    const clipsToSave = getClips();
    void saveMediaLibrary(clipsToSave);
  }, DEBOUNCE_MS);
}

export const useMediaStore = create<MediaState>((set, get) => ({
  clips: [],
  selectedClipId: null,

  addClip: (clip) => {
    set((state) => ({ clips: [...state.clips, clip] }));
    scheduleSave(() => get().clips);
  },

  addClips: (clips) => {
    if (!clips || clips.length === 0) return;
    set((state) => ({ clips: [...state.clips, ...clips] }));
    scheduleSave(() => get().clips);
  },

  removeClip: (clipId) => {
    set((state) => ({ clips: state.clips.filter((c) => c.id !== clipId) }));
    scheduleSave(() => get().clips);
  },

  clearAll: () => {
    set({ clips: [] });
    scheduleSave(() => get().clips);
  },

  selectClip: (clipId) => set({ selectedClipId: clipId }),

  initializeFromSaved: async () => {
    const result = await loadMediaLibrary();
    if (Array.isArray(result)) {
      set({ clips: result });
    }
  },
}));


