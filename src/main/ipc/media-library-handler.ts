import { IpcMainInvokeEvent } from 'electron';
// electron-store v8+ is ESM; Electron Forge transpiles ESM default import correctly in main process
import Store from 'electron-store';
import * as fs from 'fs';
import { LoadMediaLibraryResponse, SaveMediaLibraryRequest, SaveMediaLibraryResponse } from '../../types/ipc';
import { MediaClip } from '../../types/media';

const schema = {
  mediaLibrary: {
    type: 'array',
    default: [],
  },
} as const;

type Schema = {
  mediaLibrary: MediaClip[];
};

const store = new Store<Schema>({ schema });

export async function handleSaveMediaLibrary(
  _event: IpcMainInvokeEvent,
  request: SaveMediaLibraryRequest
): Promise<SaveMediaLibraryResponse> {
  store.set('mediaLibrary', request.clips);
  return { success: true };
}

export async function handleLoadMediaLibrary(
  _event: IpcMainInvokeEvent
): Promise<LoadMediaLibraryResponse> {
  const clips = (store.get('mediaLibrary') ?? []) as MediaClip[];
  const filtered = clips.filter((c) => {
    try {
      return fs.existsSync(c.path);
    } catch {
      return false;
    }
  });

  if (filtered.length !== clips.length) {
    store.set('mediaLibrary', filtered);
  }

  return { success: true, clips: filtered };
}


