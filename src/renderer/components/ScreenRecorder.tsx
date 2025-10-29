import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getScreenSources,
  setCaptureSource,
  saveRecordingFile,
  transcodeWebmToMp4,
  chooseRecordingOutput,
  openRecordingsFolder,
} from '../utils/ipc';
import { IPC_CHANNELS, isIPCError } from '../../types/ipc';
import { useMediaStore } from '../stores/mediaStore';

type Props = {
  onClose: () => void;
};

const ScreenRecorder: React.FC<Props> = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<Array<{ id: string; name: string; thumbnailDataUrl: string }>>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [includeWindows, setIncludeWindows] = useState(false);
  const [useSaveAs, setUseSaveAs] = useState(false);
  const [pipEnabled, setPipEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<string>('Idle');
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const addClips = useMediaStore((s) => s.addClips);

  // PiP-specific refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pipScreenStreamRef = useRef<MediaStream | null>(null);
  const pipCamStreamRef = useRef<MediaStream | null>(null);
  const pipMicStreamRef = useRef<MediaStream | null>(null);
  const screenVideoElRef = useRef<HTMLVideoElement | null>(null);
  const camVideoElRef = useRef<HTMLVideoElement | null>(null);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const refreshSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getScreenSources(includeWindows);
      if (isIPCError(res)) {
        setError(res.error);
        return;
      }
      setSources(res.sources);
      // Preserve the user's selection if it still exists in the new list
      if (res.sources.length > 0) {
        const stillExists = selectedId && res.sources.some(s => s.id === selectedId);
        if (!stillExists) {
          // Only reset to first source if current selection is no longer available
          setSelectedId(res.sources[0].id);
        }
      } else {
        // No sources available, clear selection
        setSelectedId('');
      }
    } catch (e) {
      setError('Failed to load sources');
    } finally {
      setLoading(false);
    }
  }, [includeWindows, selectedId]);

  useEffect(() => {
    void refreshSources();
  }, [refreshSources]);

  function cleanupStream(): void {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
    }
    streamRef.current = null;
    mediaRecorderRef.current = null;

    // Stop PiP input streams if any
    const stopAll = (s: MediaStream | null) => {
      if (s) {
        for (const t of s.getTracks()) t.stop();
      }
    };
    stopAll(pipScreenStreamRef.current);
    stopAll(pipCamStreamRef.current);
    stopAll(pipMicStreamRef.current);
    pipScreenStreamRef.current = null;
    pipCamStreamRef.current = null;
    pipMicStreamRef.current = null;

    // Cancel RAF loop
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    // Clear helper video elements
    if (screenVideoElRef.current) {
      try { screenVideoElRef.current.srcObject = null; } catch {}
      screenVideoElRef.current = null;
    }
    if (camVideoElRef.current) {
      try { camVideoElRef.current.srcObject = null; } catch {}
      camVideoElRef.current = null;
    }
    canvasRef.current = null;
  }

  const startRecording = async () => {
    if (!selectedId) {
      setError('Please select a source');
      return;
    }
    setError(null);
    setStatus('Preparing...');
    try {
      const setRes = await setCaptureSource(selectedId);
      if (isIPCError(setRes)) {
        setError(setRes.error);
        return;
      }
      if (!pipEnabled) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: includeAudio,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const options: MediaRecorderOptions = { mimeType: 'video/webm;codecs=vp8,opus' };
        const mr = new MediaRecorder(stream, options);
        chunksRef.current = [];
        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        mr.onstart = () => setStatus('Recording...');
        mr.onstop = async () => {
          setStatus('Finalizing...');
          try {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            const arrayBuffer = await blob.arrayBuffer();
            const saveRes = await saveRecordingFile(arrayBuffer, 'screen-recording');
            if (isIPCError(saveRes)) {
              setError(saveRes.error);
              showToast('error', 'Failed to save recording');
              return;
            }
            let outputPath: string | undefined = undefined;
            if (useSaveAs) {
              const choose = await chooseRecordingOutput();
              if (isIPCError(choose)) {
                // user cancelled; fall back to default
                outputPath = undefined;
              } else {
                outputPath = choose.filePath;
              }
            }

            const transRes = await transcodeWebmToMp4(saveRes.webmPath, outputPath);
            if (isIPCError(transRes)) {
              setError(transRes.error);
              showToast('error', 'Transcoding failed');
              return;
            }
            // Auto-import the mp4 and add to store
            const importRes = await window.electron.invoke(IPC_CHANNELS.IMPORT_FILE_PATHS, { paths: [transRes.mp4Path] });
            if (isIPCError(importRes)) {
              setError(importRes.error);
              showToast('error', 'Import failed');
            } else {
              const clips = (importRes as { success: true; clips: unknown[] }).clips as any[];
              if (Array.isArray(clips) && clips.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                addClips(clips as any);
              }
              setStatus('Done');
              showToast('success', 'Recording saved and imported');
            }
          } catch (e) {
            setError('Failed to finalize recording');
            showToast('error', 'Failed to finalize recording');
          } finally {
            cleanupStream();
            setIsRecording(false);
          }
        };
        mediaRecorderRef.current = mr;
        mr.start(200); // gather data every 200ms
        setIsRecording(true);
      } else {
        // PiP flow: screen + webcam composited on canvas; mic audio only
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const micStream = includeAudio ? await navigator.mediaDevices.getUserMedia({ audio: true, video: false }) : null;

        pipScreenStreamRef.current = screenStream;
        pipCamStreamRef.current = camStream;
        pipMicStreamRef.current = micStream;

        // Prepare helper video elements
        const screenVideo = document.createElement('video');
        screenVideo.muted = true;
        screenVideo.playsInline = true;
        screenVideo.srcObject = screenStream;
        await screenVideo.play();
        screenVideoElRef.current = screenVideo;

        const camVideo = document.createElement('video');
        camVideo.muted = true;
        camVideo.playsInline = true;
        camVideo.srcObject = camStream;
        await camVideo.play();
        camVideoElRef.current = camVideo;

        // Canvas sized to screen capture
        const screenSettings = screenStream.getVideoTracks()[0]?.getSettings?.() ?? {} as MediaTrackSettings;
        const cw = (screenSettings.width as number) || 1280;
        const ch = (screenSettings.height as number) || 720;
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        canvasRef.current = canvas;
        const ctx = canvas.getContext('2d');

        const margin = 16;
        const targetOverlayW = 320;
        const targetOverlayH = 240;

        const draw = () => {
          if (!ctx) return;
          try {
            ctx.drawImage(screenVideo, 0, 0, cw, ch);
            const camSettings = camStream.getVideoTracks()[0]?.getSettings?.() ?? {} as MediaTrackSettings;
            const camW = (camSettings.width as number) || targetOverlayW;
            const camH = (camSettings.height as number) || targetOverlayH;
            const scale = Math.min(targetOverlayW / camW, targetOverlayH / camH);
            const drawW = Math.max(1, Math.floor(camW * scale));
            const drawH = Math.max(1, Math.floor(camH * scale));
            const dx = cw - drawW - margin;
            const dy = ch - drawH - margin;
            ctx.drawImage(camVideo, dx, dy, drawW, drawH);
          } catch {
            // ignore draw errors during teardown
          }
          rafIdRef.current = requestAnimationFrame(draw);
        };
        draw();

        const compositeStream = canvas.captureStream(30);
        if (micStream) {
          const at = micStream.getAudioTracks()[0];
          if (at) compositeStream.addTrack(at);
        }
        streamRef.current = compositeStream;
        if (videoRef.current) {
          videoRef.current.srcObject = compositeStream;
          await videoRef.current.play();
        }

        const options: MediaRecorderOptions = { mimeType: 'video/webm;codecs=vp8,opus' };
        const mr = new MediaRecorder(compositeStream, options);
        chunksRef.current = [];
        mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstart = () => setStatus('Recording...');
        mr.onstop = async () => {
          setStatus('Finalizing...');
          try {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            const arrayBuffer = await blob.arrayBuffer();
            const saveRes = await saveRecordingFile(arrayBuffer, 'screen-webcam-pip');
            if (isIPCError(saveRes)) {
              setError(saveRes.error);
              showToast('error', 'Failed to save recording');
              return;
            }
            let outputPath: string | undefined = undefined;
            if (useSaveAs) {
              const choose = await chooseRecordingOutput();
              if (isIPCError(choose)) {
                outputPath = undefined;
              } else {
                outputPath = choose.filePath;
              }
            }
            const transRes = await transcodeWebmToMp4(saveRes.webmPath, outputPath);
            if (isIPCError(transRes)) {
              setError(transRes.error);
              showToast('error', 'Transcoding failed');
              return;
            }
            const importRes = await window.electron.invoke(IPC_CHANNELS.IMPORT_FILE_PATHS, { paths: [transRes.mp4Path] });
            if (isIPCError(importRes)) {
              setError(importRes.error);
              showToast('error', 'Import failed');
            } else {
              const clips = (importRes as { success: true; clips: unknown[] }).clips as any[];
              if (Array.isArray(clips) && clips.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                addClips(clips as any);
              }
              setStatus('Done');
              showToast('success', 'Recording saved and imported');
            }
          } catch {
            setError('Failed to finalize recording');
            showToast('error', 'Failed to finalize recording');
          } finally {
            cleanupStream();
            setIsRecording(false);
          }
        };
        mediaRecorderRef.current = mr;
        mr.start(200);
        setIsRecording(true);
      }
    } catch (e) {
      const errName = (e as { name?: string }).name;
      if (errName === 'NotAllowedError') {
        setError('Permission denied. Enable Screen Recording, Camera, and Microphone in System Settings → Privacy & Security.');
      } else if (errName === 'NotFoundError') {
        setError('Required device not found. Connect a camera/microphone and try again.');
      } else {
        setError('Recording failed to start. Ensure screen/camera/mic permissions are granted.');
      }
      cleanupStream();
    }
  };

  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      } else {
        cleanupStream();
        setIsRecording(false);
      }
    } catch {
      cleanupStream();
      setIsRecording(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => { if (!isRecording) onClose(); }} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-gray-800">Screen Recorder</h3>
          <button
            onClick={() => { if (!isRecording) onClose(); }}
            className="text-gray-500 hover:text-gray-700"
            title="Close"
            disabled={isRecording}
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-3 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-700">Available Sources</span>
              <button
                onClick={() => void refreshSources()}
                className="text-sm text-blue-600 hover:text-blue-700"
                disabled={loading || isRecording}
              >
                Refresh
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2">
              {sources.map((s) => (
                <label key={s.id} className={`flex gap-3 p-2 border rounded hover:bg-gray-50 cursor-pointer ${selectedId === s.id ? 'border-blue-500' : 'border-gray-200'}`}>
                  <input type="radio" name="source" value={s.id} checked={selectedId === s.id} onChange={() => setSelectedId(s.id)} disabled={isRecording} />
                  <img src={s.thumbnailDataUrl} alt={s.name} className="w-32 h-20 object-cover rounded border" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.id}</div>
                  </div>
                </label>
              ))}
              {sources.length === 0 && !loading && (
                <div className="text-sm text-gray-500">No sources found.</div>
              )}
            </div>
          </div>
          <div>
            <div className="mb-2 font-semibold text-gray-700">Preview</div>
            <video ref={videoRef} className="w-full aspect-video bg-black rounded" muted playsInline />
            <div className="mt-3 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={includeAudio} onChange={(e) => setIncludeAudio(e.target.checked)} disabled={isRecording} />
                Capture audio (if available)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!includeWindows} onChange={(e) => setIncludeWindows(!e.target.checked)} disabled={isRecording} />
                Screen only (exclude windows)
              </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={pipEnabled} onChange={(e) => setPipEnabled(e.target.checked)} disabled={isRecording} />
              Include webcam overlay (PiP)
            </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={useSaveAs} onChange={(e) => setUseSaveAs(e.target.checked)} disabled={isRecording} />
                Save As...
              </label>
            </div>
            <div className="mt-2 text-sm text-gray-600">Status: {status}</div>
            {status === 'Done' && (
              <div className="mt-2">
                <button
                  onClick={async () => {
                    const res = await openRecordingsFolder();
                    if (isIPCError(res)) {
                      showToast('error', 'Failed to open recordings folder');
                    }
                  }}
                  className="px-3 py-2 rounded border text-gray-700 hover:bg-gray-50 text-sm"
                >
                  Open recordings folder
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          {!isRecording ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded border text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void startRecording()}
                disabled={!selectedId || loading}
                className={`px-4 py-2 rounded text-white ${(!selectedId || loading) ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
              >
                Start Recording
              </button>
            </>
          ) : (
            <button
              onClick={stopRecording}
              className="px-4 py-2 rounded text-white bg-red-600 hover:bg-red-700"
            >
              Stop Recording
            </button>
          )}
        </div>
      </div>
      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded shadow-lg ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default ScreenRecorder;


