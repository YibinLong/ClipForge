import React, { useEffect, useMemo, useState } from 'react';
import { useTimelineStore } from '../stores/timelineStore';
import { useMediaStore } from '../stores/mediaStore';
import { cancelExport, onExportProgress, startExportTimeline } from '../utils/ipc';
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
  const [inFlight, setInFlight] = useState(false);
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<'idle' | 'processing' | 'complete' | 'error' | 'cancelled'>('idle');
  const [error, setError] = useState<string | null>(null);

  const canStart = useMemo(() => timeline.some((c) => c.trackId === 1), [timeline]);

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
  }, [open]);

  const start = async () => {
    setError(null);
    setStatus('processing');
    setProgress(0);
    setEta(undefined);
    setInFlight(true);
    const req = {
      timeline,
      media,
      trackId: 1,
      resolution,
      suggestedName: 'timeline-export',
    } as const;
    await startExportTimeline(req);
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
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={() => {
              if (!inFlight) onClose();
            }}
            aria-label="Close"
          >
            ✕
          </button>
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

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <div className="flex gap-2 justify-end mt-4">
            {!inFlight && (
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


