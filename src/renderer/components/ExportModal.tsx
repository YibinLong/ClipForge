import React, { useEffect, useMemo, useState } from 'react';
import { useTimelineStore } from '../stores/timelineStore';
import { useMediaStore } from '../stores/mediaStore';
import { cancelExport, onExportProgress, startExportTimeline, revealInFolder } from '../utils/ipc';
import { ExportProgressEvent } from '../../types/ipc';

type Resolution = 'source' | '720p' | '1080p';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ open, onClose }) => {
  const timeline = useTimelineStore((s) => s.clips);
  const media = useMediaStore((s) => s.clips);
  const [resolution, setResolution] = useState<Resolution>('1080p');
  const [enableSubtitles, setEnableSubtitles] = useState<boolean>(true);
  const [inFlight, setInFlight] = useState(false);
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<'idle' | 'processing' | 'complete' | 'error' | 'cancelled'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [chosenOutputPath, setChosenOutputPath] = useState<string | null>(null);
  const [didReveal, setDidReveal] = useState(false);

  const canStart = useMemo(() => timeline.some((c) => c.trackId === 1), [timeline]);
  const hasAnyCaptions = useMemo(() => media.some((m) => !!m.subtitlesPath), [media]);

  // Reset all state when modal opens
  useEffect(() => {
    if (open) {
      setProgress(0);
      setStatus('idle');
      setEta(undefined);
      setError(null);
      setInFlight(false);
      setEnableSubtitles(true);
    }
  }, [open]);

  // Close on Escape key (when not in-flight)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !inFlight) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, inFlight, onClose]);

  useEffect(() => {
    if (!open) return;
    const unsubscribe = onExportProgress((e: ExportProgressEvent) => {
      setStatus(e.status);
      if (e.status === 'processing') {
        setProgress(Math.max(0, Math.min(100, e.percent)));
        setEta(e.etaSeconds);
      } else if (e.status === 'complete') {
        setProgress(100);
        setEta(0);
        setInFlight(false);
        // Auto reveal the exported file in folder (best effort)
        if (chosenOutputPath && !didReveal) {
          setDidReveal(true);
          void revealInFolder(chosenOutputPath);
        }
      } else if (e.status === 'cancelled') {
        setInFlight(false);
      } else if (e.status === 'error') {
        setError(e.errorMessage ?? 'Export failed');
        setInFlight(false);
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [open, chosenOutputPath, didReveal]);

  const start = async () => {
    setError(null);
    setStatus('processing');
    setProgress(0);
    setEta(undefined);
    setInFlight(true);
    setChosenOutputPath(null);
    setDidReveal(false);
    
    try {
      const req = {
        timeline,
        media,
        trackId: 1,
        resolution,
        enableSubtitles,
        suggestedName: 'timeline-export',
      } as const;
      const result = await startExportTimeline(req);
      
      // Handle IPC-level errors (e.g., validation failures, cancelled save dialog)
      if (!result.success) {
        setError(result.error || 'Failed to start export');
        setStatus('error');
        setInFlight(false);
      } else {
        // Remember selected output path for reveal-on-complete
        const out = (result as { success: true; outputPath?: string }).outputPath;
        if (out) setChosenOutputPath(out);
      }
    } catch (err) {
      // Handle unexpected errors (e.g., IPC communication failure)
      setError(err instanceof Error ? err.message : 'Failed to start export');
      setStatus('error');
      setInFlight(false);
    }
  };

  const cancel = async () => {
    await cancelExport();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Export Timeline</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resolution</label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value as Resolution)}
              className="w-full border rounded-md px-3 py-2"
              disabled={inFlight}
            >
              <option value="source">Source Resolution</option>
              <option value="720p">720p (1280x720)</option>
              <option value="1080p">1080p (1920x1080)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="include-captions"
              type="checkbox"
              className="h-4 w-4"
              checked={enableSubtitles && hasAnyCaptions}
              onChange={(e) => setEnableSubtitles(e.target.checked)}
              disabled={inFlight || !hasAnyCaptions}
            />
            <label htmlFor="include-captions" className={`text-sm ${!hasAnyCaptions ? 'text-gray-400' : 'text-gray-700'}`}>
              Include Captions (burned-in)
            </label>
          </div>

          {(status === 'processing' || status === 'complete' || inFlight) && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-indigo-600 h-3 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>{Math.round(progress)}%</span>
                <span>{eta !== undefined ? `${Math.max(0, Math.ceil(eta))}s left` : ''}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          {status === 'complete' && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm">
              <div className="flex items-center gap-2 text-green-800 font-semibold mb-1">
                <span className="text-lg">✅</span>
                <span>Export Complete!</span>
              </div>
              <p className="text-green-700 text-xs">
                Your video has been saved. Check the folder you selected to find your exported file.
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end mt-4">
            {(status === 'idle' || status === 'error' || status === 'cancelled') && (
              <button
                className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50"
                disabled={!canStart}
                onClick={start}
              >
                Start Export
              </button>
            )}
            {inFlight && (
              <button
                className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300"
                onClick={cancel}
              >
                Cancel
              </button>
            )}
            {!inFlight && (
              <button
                className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200"
                onClick={onClose}
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;


