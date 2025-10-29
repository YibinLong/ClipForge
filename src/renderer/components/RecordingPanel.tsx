import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type MicDevice = { deviceId: string; label: string };

type Mode = 'screen' | 'webcam' | 'both';

const RecordingPanel: React.FC<Props> = ({ onClose }) => {
  // UI state
  const [mode, setMode] = useState<Mode>('screen');
  const [status, setStatus] = useState<string>('Idle');
  const [error, setError] = useState<string | null>(null);
  const [useSaveAs, setUseSaveAs] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Timer
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const pauseStartRef = useRef<number | null>(null);
  const pausedAccumulatedRef = useRef<number>(0);

  // Preview
  const previewRef = useRef<HTMLVideoElement | null>(null);

  // Streams and recorder
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const outStreamRef = useRef<MediaStream | null>(null);

  // For PiP composition
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pipScreenStreamRef = useRef<MediaStream | null>(null);
  const pipCamStreamRef = useRef<MediaStream | null>(null);
  const pipMicStreamRef = useRef<MediaStream | null>(null);
  const screenVideoElRef = useRef<HTMLVideoElement | null>(null);
  const camVideoElRef = useRef<HTMLVideoElement | null>(null);

  // Mic selection & meter
  const [mics, setMics] = useState<MicDevice[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [noMicWarning, setNoMicWarning] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const [meterLevel, setMeterLevel] = useState<number>(0);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Screen source list (for screen/both modes)
  const [includeWindows, setIncludeWindows] = useState(false);
  const [sources, setSources] = useState<Array<{ id: string; name: string; thumbnailDataUrl: string }>>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [loadingSources, setLoadingSources] = useState(false);

  const addClips = useMediaStore((s) => s.addClips);

  const formattedTime = useMemo(() => {
    const total = Math.max(0, elapsedMs);
    const s = Math.floor(total / 1000);
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
  }, [elapsedMs]);

  // Enumerate microphones
  const enumerateMics = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const list = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d, idx) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${idx + 1}` }));
      setMics(list);
      setNoMicWarning(list.length === 0);
      if (list.length > 0 && !list.some((m) => m.deviceId === selectedMicId)) {
        setSelectedMicId(list[0].deviceId);
      }
    } catch {
      setError('Failed to enumerate microphones');
    }
  }, [selectedMicId]);

  useEffect(() => {
    void enumerateMics();
  }, [enumerateMics]);

  // Screen sources
  const refreshSources = useCallback(async () => {
    setLoadingSources(true);
    try {
      const res = await getScreenSources(includeWindows);
      if (isIPCError(res)) {
        setError(res.error);
        return;
      }
      setSources(res.sources);
      if (res.sources.length > 0 && !res.sources.some((s) => s.id === selectedSourceId)) {
        setSelectedSourceId(res.sources[0].id);
      }
    } catch {
      setError('Failed to load screen sources');
    } finally {
      setLoadingSources(false);
    }
  }, [includeWindows, selectedSourceId]);

  useEffect(() => {
    if (mode !== 'webcam') void refreshSources();
  }, [mode, refreshSources]);

  // Live preview: build and attach preview stream when options change (not recording)
  useEffect(() => {
    let cancelled = false;
    const setupPreview = async () => {
      if (isRecording) return;
      try {
        // Teardown any existing preview stream first
        cleanupStreams();

        let stream: MediaStream | null = null;
        if (mode === 'screen') {
          if (!selectedSourceId) return;
          const res = await setCaptureSource(selectedSourceId);
          if (isIPCError(res)) return;
          stream = await buildScreenWithMic();
        } else if (mode === 'both') {
          if (!selectedSourceId) return;
          const res = await setCaptureSource(selectedSourceId);
          if (isIPCError(res)) return;
          stream = await buildPiPWithMic();
        } else {
          stream = await buildWebcamWithMic();
        }
        if (!cancelled && stream) {
          await attachPreview(stream);
          setStatus('Preview ready');
        }
      } catch {
        // Ignore preview preparation errors (user may not have granted permissions yet)
      }
    };
    void setupPreview();
    return () => {
      cancelled = true;
    };
  }, [mode, selectedSourceId, selectedMicId, includeWindows, isRecording]);

  // Audio meter setup/cleanup
  const startMeter = useCallback((stream: MediaStream) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const ctx = audioCtxRef.current;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        // Compute RMS
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128; // -1..1
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setMeterLevel(Math.min(1, rms));
        meterRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      // Ignore meter setup failures
    }
  }, []);

  const stopMeter = useCallback(() => {
    if (meterRafRef.current !== null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    if (analyserRef.current) analyserRef.current.disconnect();
    if (audioCtxRef.current) {
      try { 
        // Avoid closing shared context to prevent errors
      } catch (err) {
        // Ignore errors
      }
    }
    setMeterLevel(0);
  }, []);

  // Timer updates
  useEffect(() => {
    if (!isRecording) return;
    const id = window.setInterval(() => {
      if (startTimeRef.current === null) return;
      const now = Date.now();
      const pausedOffset = pausedAccumulatedRef.current + (pauseStartRef.current ? (now - pauseStartRef.current) : 0);
      setElapsedMs(now - startTimeRef.current - pausedOffset);
    }, 200);
    return () => clearInterval(id);
  }, [isRecording]);

  function cleanupStreams(): void {
    // Stop output stream
    if (outStreamRef.current) {
      for (const t of outStreamRef.current.getTracks()) t.stop();
      outStreamRef.current = null;
    }
    // Stop mic stream (if separate)
    if (micStreamRef.current) {
      for (const t of micStreamRef.current.getTracks()) t.stop();
      micStreamRef.current = null;
    }
    // Stop PiP input streams
    const stopAll = (s: MediaStream | null) => { if (s) for (const t of s.getTracks()) t.stop(); };
    stopAll(pipScreenStreamRef.current);
    stopAll(pipCamStreamRef.current);
    stopAll(pipMicStreamRef.current);
    pipScreenStreamRef.current = null;
    pipCamStreamRef.current = null;
    pipMicStreamRef.current = null;

    // Cancel composition RAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    // Clear helper videos
    if (screenVideoElRef.current) {
      try { 
        screenVideoElRef.current.srcObject = null; 
      } catch (err) {
        // Ignore errors
      }
      screenVideoElRef.current = null;
    }
    if (camVideoElRef.current) {
      try { 
        camVideoElRef.current.srcObject = null; 
      } catch (err) {
        // Ignore errors
      }
      camVideoElRef.current = null;
    }

    // Stop meter
    stopMeter();
  }

  const attachPreview = async (stream: MediaStream) => {
    outStreamRef.current = stream;
    if (previewRef.current) {
      previewRef.current.srcObject = stream;
      try { 
        await previewRef.current.play(); 
      } catch (err) {
        // Ignore play errors
      }
    }
  };

  const buildScreenWithMic = async (): Promise<MediaStream> => {
    const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    let mic: MediaStream | null = null;
    try {
      if (selectedMicId) {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: selectedMicId } }, video: false });
      } else {
        mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
    } catch {
      mic = null;
      setNoMicWarning(true);
    }

    const composed = new MediaStream();
    for (const vt of screen.getVideoTracks()) composed.addTrack(vt);
    if (mic) {
      const at = mic.getAudioTracks()[0];
      if (at) composed.addTrack(at);
      micStreamRef.current = mic;
      startMeter(mic);
    }
    return composed;
  };

  const buildPiPWithMic = async (): Promise<MediaStream> => {
    const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const cam = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    let mic: MediaStream | null = null;
    try {
      if (selectedMicId) {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: selectedMicId } }, video: false });
      } else {
        mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
    } catch {
      mic = null;
      setNoMicWarning(true);
    }

    pipScreenStreamRef.current = screen;
    pipCamStreamRef.current = cam;
    pipMicStreamRef.current = mic;

    // Prepare helper video elements
    const screenVideo = document.createElement('video');
    screenVideo.muted = true;
    screenVideo.playsInline = true;
    screenVideo.srcObject = screen;
    await screenVideo.play();
    screenVideoElRef.current = screenVideo;

    const camVideo = document.createElement('video');
    camVideo.muted = true;
    camVideo.playsInline = true;
    camVideo.srcObject = cam;
    await camVideo.play();
    camVideoElRef.current = camVideo;

    // Canvas = screen size
    const screenSettings = screen.getVideoTracks()[0]?.getSettings?.() ?? ({} as MediaTrackSettings);
    const cw = (screenSettings.width as number) || 1280;
    const ch = (screenSettings.height as number) || 720;
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    canvasRef.current = canvas;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      if (!ctx || !screenVideoElRef.current || !camVideoElRef.current) {
        rafIdRef.current = requestAnimationFrame(draw);
        return;
      }
      try {
        ctx.drawImage(screenVideoElRef.current, 0, 0, cw, ch);
        // Draw webcam bottom-right
        const margin = 16;
        const targetOverlayW = 320;
        const targetOverlayH = 240;
        const camTrackSettings = cam.getVideoTracks()[0]?.getSettings?.() ?? ({} as MediaTrackSettings);
        const camW = (camTrackSettings.width as number) || targetOverlayW;
        const camH = (camTrackSettings.height as number) || targetOverlayH;
        const scale = Math.min(targetOverlayW / camW, targetOverlayH / camH);
        const drawW = Math.max(1, Math.floor(camW * scale));
        const drawH = Math.max(1, Math.floor(camH * scale));
        const dx = cw - drawW - margin;
        const dy = ch - drawH - margin;
        ctx.drawImage(camVideoElRef.current, dx, dy, drawW, drawH);
      } catch (err) {
        // Ignore draw errors during teardown
      }
      rafIdRef.current = requestAnimationFrame(draw);
    };
    draw();

    const compositeStream = canvas.captureStream(30);
    if (mic) {
      const at = mic.getAudioTracks()[0];
      if (at) compositeStream.addTrack(at);
      micStreamRef.current = mic;
      startMeter(mic);
    }
    return compositeStream;
  };

  const buildWebcamWithMic = async (): Promise<MediaStream> => {
    let stream: MediaStream | null = null;
    let mic: MediaStream | null = null;
    try {
      // Webcam video, audio false (we will add selected mic explicitly)
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch {
      throw new Error('Failed to access webcam');
    }
    try {
      if (selectedMicId) {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: selectedMicId } }, video: false });
      } else {
        mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
    } catch {
      mic = null;
      setNoMicWarning(true);
    }

    const composed = new MediaStream();
    for (const vt of stream.getVideoTracks()) composed.addTrack(vt);
    if (mic) {
      const at = mic.getAudioTracks()[0];
      if (at) composed.addTrack(at);
      micStreamRef.current = mic;
      startMeter(mic);
    }
    return composed;
  };

  const startRecording = async () => {
    if (isRecording) return;
    setError(null);
    setStatus('Preparing...');
    try {
      // For screen/both, we respect selected screen source
      if ((mode === 'screen' || mode === 'both') && selectedSourceId) {
        const res = await setCaptureSource(selectedSourceId);
        if (isIPCError(res)) {
          setError(res.error);
          return;
        }
      }

      let stream: MediaStream;
      if (mode === 'screen') {
        stream = await buildScreenWithMic();
      } else if (mode === 'both') {
        stream = await buildPiPWithMic();
      } else {
        stream = await buildWebcamWithMic();
      }

      await attachPreview(stream);

      const mrOptions: MediaRecorderOptions = { mimeType: 'video/webm;codecs=vp8,opus' };
      const mr = new MediaRecorder(stream, mrOptions);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstart = () => setStatus('Recording...');
      mr.onpause = () => setStatus('Paused');
      mr.onresume = () => setStatus('Recording...');
      mr.onstop = async () => {
        setStatus('Finalizing...');
        setIsFinalizing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          const arr = await blob.arrayBuffer();
          const hint = mode === 'screen' ? 'screen-recording' : (mode === 'both' ? 'screen-webcam-pip' : 'webcam-recording');
          const saveRes = await saveRecordingFile(arr, hint);
          if (isIPCError(saveRes)) {
            setError(saveRes.error);
            return;
          }

          let outputPath: string | undefined = undefined;
          if (useSaveAs) {
            const choose = await chooseRecordingOutput();
            if (!isIPCError(choose)) {
              outputPath = choose.filePath;
            }
          }

          const transRes = await transcodeWebmToMp4(saveRes.webmPath, outputPath);
          if (isIPCError(transRes)) {
            setError(transRes.error);
            return;
          }

          const importRes = await window.electron.invoke(IPC_CHANNELS.IMPORT_FILE_PATHS, { paths: [transRes.mp4Path] });
          if (isIPCError(importRes)) {
            setError(importRes.error);
          } else {
            const clips = (importRes as { success: true; clips: unknown[] }).clips as any[];
            if (Array.isArray(clips) && clips.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              addClips(clips as any);
            }
            setStatus('Done');
          }
        } catch {
          setError('Failed to finalize recording');
        } finally {
          cleanupStreams();
          setIsRecording(false);
          setIsPaused(false);
          startTimeRef.current = null;
          pauseStartRef.current = null;
          pausedAccumulatedRef.current = 0;
        }
        setIsFinalizing(false);
      };
      mediaRecorderRef.current = mr;
      mr.start(200);
      setIsRecording(true);
      setIsPaused(false);
      startTimeRef.current = Date.now();
      pauseStartRef.current = null;
      pausedAccumulatedRef.current = 0;
    } catch (e) {
      const errName = (e as { name?: string }).name;
      if (errName === 'NotAllowedError') {
        setError('Permission denied. Enable Screen Recording / Camera / Microphone in System Settings → Privacy & Security.');
      } else if (errName === 'NotFoundError') {
        setError('Required device not found. Connect a camera/microphone and try again.');
      } else {
        setError('Failed to start recording.');
      }
      cleanupStreams();
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const stopRecording = () => {
    if (isFinalizing) return;
    try {
      // Freeze timer immediately when user presses Stop
      if (!isPaused) {
        setIsPaused(true);
        pauseStartRef.current = Date.now();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      } else {
        cleanupStreams();
        setIsRecording(false);
        setIsPaused(false);
      }
    } catch {
      cleanupStreams();
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const pauseRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      pauseStartRef.current = Date.now();
    }
  };

  const resumeRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      if (pauseStartRef.current) {
        pausedAccumulatedRef.current += Date.now() - pauseStartRef.current;
        pauseStartRef.current = null;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => { if (!isRecording) onClose(); }} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-gray-800">Recording Panel</h3>
        </div>

        {error && (
          <div className="mb-3 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>
        )}
        {noMicWarning && (
          <div className="mb-3 p-3 rounded bg-yellow-50 text-yellow-800 text-sm">
            No microphone detected. Recording will proceed without audio.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: options */}
          <div>
            <div className="mb-4">
              <div className="font-semibold text-gray-700 mb-2">Recording Type</div>
              <div className="flex gap-4 text-sm text-gray-700">
                <label className="flex items-center gap-2">
                  <input type="radio" name="mode" value="screen" checked={mode === 'screen'} onChange={() => setMode('screen')} disabled={isRecording} />
                  Screen
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="mode" value="webcam" checked={mode === 'webcam'} onChange={() => setMode('webcam')} disabled={isRecording} />
                  Webcam
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="mode" value="both" checked={mode === 'both'} onChange={() => setMode('both')} disabled={isRecording} />
                  Both (PiP)
                </label>
              </div>
            </div>

            <div className="mb-4">
              <div className="font-semibold text-gray-700 mb-2">Microphone</div>
              <div className="flex items-center gap-2">
                <select
                  className="border rounded px-2 py-2 w-full"
                  value={selectedMicId}
                  onChange={(e) => setSelectedMicId(e.target.value)}
                  disabled={isRecording || mics.length === 0}
                >
                  {mics.map((m) => (
                    <option key={m.deviceId} value={m.deviceId}>{m.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => void enumerateMics()}
                  className="text-sm text-blue-600 hover:text-blue-700"
                  disabled={isRecording}
                >
                  Refresh
                </button>
              </div>
              <div className="mt-2">
                <div className="h-2 bg-gray-200 rounded">
                  <div className="h-2 bg-green-600 rounded" style={{ width: `${Math.round(meterLevel * 100)}%` }} />
                </div>
                <div className="text-xs text-gray-500 mt-1">Audio level</div>
              </div>
            </div>

            {(mode === 'screen' || mode === 'both') && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-700">Available Sources</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={!includeWindows} onChange={(e) => setIncludeWindows(!e.target.checked)} disabled={isRecording} />
                      Screen only (exclude windows)
                    </label>
                    <button onClick={() => void refreshSources()} className="text-sm text-blue-600 hover:text-blue-700" disabled={loadingSources || isRecording}>Refresh</button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {sources.map((s) => (
                    <label key={s.id} className={`flex gap-3 p-2 border rounded hover:bg-gray-50 cursor-pointer ${selectedSourceId === s.id ? 'border-blue-500' : 'border-gray-200'}`}>
                      <input type="radio" name="source" value={s.id} checked={selectedSourceId === s.id} onChange={() => setSelectedSourceId(s.id)} disabled={isRecording} />
                      <img src={s.thumbnailDataUrl} alt={s.name} className="w-28 h-16 object-cover rounded border" />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{(function pretty() {
                          // Friendly name: e.g., "Screen 1" instead of "screen:1:0"
                          if (s.id.startsWith('screen:')) {
                            const m = s.id.match(/^screen:(\d+):/);
                            if (m) return `Screen ${m[1]}`;
                            return 'Screen';
                          }
                          // Windows: just show the window title (s.name)
                          return s.name || 'Window';
                        })()}</div>
                      </div>
                    </label>
                  ))}
                  {sources.length === 0 && !loadingSources && (
                    <div className="text-sm text-gray-500">No sources found.</div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={useSaveAs} onChange={(e) => setUseSaveAs(e.target.checked)} disabled={isRecording} />
                Choose save location after recording
              </label>
            </div>

            <div className="mt-2 text-sm text-gray-600">Status: {status}</div>
            <div className="mt-1 text-sm text-gray-600">Timer: {formattedTime}</div>
          </div>

          {/* Right: preview */}
          <div>
            <div className="mb-2 font-semibold text-gray-700">Preview</div>
            <div className="relative">
              <video ref={previewRef} className="block mx-auto max-w-full max-h-80 w-auto h-auto rounded object-contain bg-transparent" muted playsInline />
              {(isFinalizing || status === 'Done') && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded">
                  <div className="text-white text-lg font-semibold">
                    {isFinalizing ? 'Finalizing…' : 'Done'}
                  </div>
                </div>
              )}
            </div>
            {status === 'Done' && (
              <div className="mt-3">
                <button
                  onClick={async () => { const res = await openRecordingsFolder(); if (isIPCError(res)) setError('Failed to open recordings folder'); }}
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
              <button onClick={onClose} className="px-4 py-2 rounded border text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={() => void startRecording()} className="px-4 py-2 rounded text-white bg-green-600 hover:bg-green-700">Start Recording</button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              {!isPaused ? (
                <button onClick={pauseRecording} className="px-4 py-2 rounded text-white bg-amber-600 hover:bg-amber-700" disabled={isFinalizing}>Pause</button>
              ) : (
                <button onClick={resumeRecording} className="px-4 py-2 rounded text-white bg-blue-600 hover:bg-blue-700" disabled={isFinalizing}>Resume</button>
              )}
              <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" title="Recording" />
              <button onClick={stopRecording} className="px-4 py-2 rounded text-white bg-red-600 hover:bg-red-700 disabled:opacity-60" disabled={isFinalizing}>Stop Recording</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordingPanel;


