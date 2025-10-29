import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
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

type CameraDevice = {
  deviceId: string;
  label: string;
};

const WebcamRecorder: React.FC<Props> = ({ onClose }) => {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [useSaveAs, setUseSaveAs] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<string>('Idle');
  const [error, setError] = useState<string | null>(null);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const addClips = useMediaStore((s) => s.addClips);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const enumerate = useCallback(async () => {
    setLoadingDevices(true);
    setError(null);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, idx) => ({ deviceId: d.deviceId, label: d.label || `Camera ${idx + 1}` }));
      setCameras(cams);
      if (cams.length > 0 && !cams.some((c) => c.deviceId === selectedCameraId)) {
        setSelectedCameraId(cams[0].deviceId);
      }
    } catch {
      setError('Failed to enumerate devices');
    } finally {
      setLoadingDevices(false);
    }
  }, [selectedCameraId]);

  useEffect(() => {
    void enumerate();
  }, [enumerate]);

  function cleanupStream(): void {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
    }
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }

  const startRecording = async (): Promise<void> => {
    setError(null);
    setStatus('Preparing...');
    try {
      const constraints: MediaStreamConstraints = {
        video: selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true,
        audio: includeAudio,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const options: MediaRecorderOptions = { mimeType: 'video/webm;codecs=vp8,opus' };
      const mr = new MediaRecorder(stream, options);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstart = () => setStatus('Recording...');
      mr.onstop = async () => {
        setStatus('Finalizing...');
        try {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          const arrayBuffer = await blob.arrayBuffer();
          const saveRes = await saveRecordingFile(arrayBuffer, 'webcam-recording');
          if (isIPCError(saveRes)) {
            setError(saveRes.error);
            showToast('error', 'Failed to save recording');
            return;
          }

          let outputPath: string | undefined = undefined;
          if (useSaveAs) {
            const choose = await chooseRecordingOutput();
            if (isIPCError(choose)) {
              // User cancelled the save dialog or an error occurred
              setError('Save cancelled or failed');
              showToast('error', 'Recording not saved - dialog cancelled');
              setStatus('Idle');
              return;
            }
            outputPath = choose.filePath;
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
    } catch (e) {
      const errName = (e as { name?: string }).name;
      if (errName === 'NotAllowedError') {
        setError('Permission denied. On macOS, enable Camera and Microphone in System Settings → Privacy & Security.');
      } else if (errName === 'NotFoundError') {
        setError('No webcam or microphone found. Connect a device and try again.');
      } else {
        setError('Failed to start webcam recording.');
      }
      cleanupStream();
      setIsRecording(false);
    }
  };

  const stopRecording = (): void => {
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
          <h3 className="text-2xl font-bold text-gray-800">Webcam Recorder</h3>
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
            <div className="mb-2 font-semibold text-gray-700">Camera</div>
            <div className="flex items-center gap-2 mb-3">
              <select
                className="border rounded px-2 py-2 w-full"
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                disabled={isRecording || loadingDevices || cameras.length === 0}
              >
                {cameras.map((c) => (
                  <option key={c.deviceId} value={c.deviceId}>{c.label}</option>
                ))}
              </select>
              <button
                onClick={() => void enumerate()}
                className="text-sm text-blue-600 hover:text-blue-700"
                disabled={loadingDevices || isRecording}
              >
                Refresh
              </button>
            </div>
            {cameras.length === 0 && !loadingDevices && (
              <div className="text-sm text-gray-500">No cameras found.</div>
            )}
          </div>
          <div>
            <div className="mb-2 font-semibold text-gray-700">Preview</div>
            <video ref={videoRef} className="w-full aspect-video bg-black rounded" muted playsInline />
            <div className="mt-3 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={includeAudio} onChange={(e) => setIncludeAudio(e.target.checked)} disabled={isRecording} />
                Capture audio (microphone)
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
                    if (isIPCError(res)) showToast('error', 'Failed to open recordings folder');
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
                disabled={!selectedCameraId || cameras.length === 0}
                className={`px-4 py-2 rounded text-white ${(!selectedCameraId || cameras.length === 0) ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
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

export default WebcamRecorder;


