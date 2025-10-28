import { create } from 'zustand';
import { MediaClip } from '../../types/media';
import { loadMediaLibrary, saveMediaLibrary } from '../utils/ipc';

type MediaState = {
  clips: MediaClip[];
  selectedClipId: string | null;
  isInitializing: boolean;
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
  isInitializing: false,

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
    // Set initializing flag to true at start
    set({ isInitializing: true });
    
    try {
      const result = await loadMediaLibrary();
      if (Array.isArray(result)) {
        // RACE CONDITION FIX:
        // Only set clips if no clips were added during initialization
        // This prevents overwriting clips that were imported while loading
        set((state) => {
          if (state.clips.length === 0) {
            // Safe to load: no clips were added during initialization
            return { clips: result, isInitializing: false };
          } else {
            // Clips were added during load - keep them and don't overwrite
            console.warn('[MEDIA STORE] Clips were added during initialization. Keeping new clips.');
            return { isInitializing: false };
          }
        });
      } else {
        set({ isInitializing: false });
      }
    } catch (error) {
      console.error('[MEDIA STORE] Error loading media library:', error);
      set({ isInitializing: false });
    }
  },
}));


