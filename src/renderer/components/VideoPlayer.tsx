import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTimelineStore } from '../stores/timelineStore';

interface VideoPlayerProps {
  /** Back-compat single source (mapped to baseSrc) */
  src?: string | null;
  /** Base (Track 1) source and time */
  baseSrc?: string | null;
  baseExternalTime?: number | null;
  /** Overlay (Track 2) source and time */
  overlaySrc?: string | null;
  overlayExternalTime?: number | null;
  /** External playback control applies to both */
  externalIsPlaying?: boolean;
  /** Reports base media time (seconds within source) back to parent */
  onBaseMediaTimeUpdate?: (mediaTime: number) => void;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, baseSrc, overlaySrc, externalIsPlaying, baseExternalTime, overlayExternalTime, onBaseMediaTimeUpdate }) => {
  const baseVideoRef = useRef<HTMLVideoElement | null>(null);
  const overlayVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [hasError, setHasError] = useState<string | null>(null);
  const [audioSource, setAudioSource] = useState<'track1' | 'track2'>('track1');
  const playTimeline = useTimelineStore((s) => s.play);
  const pauseTimeline = useTimelineStore((s) => s.pause);

  // Normalize props: prefer explicit baseSrc, else fall back to legacy src
  const effectiveBaseSrc = typeof baseSrc !== 'undefined' ? baseSrc : (typeof src !== 'undefined' ? src : null);

  // Reset player state when src changes
  useEffect(() => {
    const base = baseVideoRef.current;
    setHasError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    if (base) {
      try {
        base.pause();
        base.load();
      } catch {}
    }
    const overlay = overlayVideoRef.current;
    if (overlay) {
      try {
        overlay.pause();
        overlay.load();
      } catch {}
    }
  }, [effectiveBaseSrc, overlaySrc]);

  // Attach media event listeners
  useEffect(() => {
    const base = baseVideoRef.current;
    if (!base) return;

    const onLoadedMetadata = () => {
      setDuration(Number.isFinite(base.duration) ? base.duration : 0);
      setCurrentTime(Number.isFinite(base.currentTime) ? base.currentTime : 0);
    };
    const onTimeUpdate = () => {
      const t = Number.isFinite(base.currentTime) ? base.currentTime : 0;
      setCurrentTime(t);
      if (onBaseMediaTimeUpdate) onBaseMediaTimeUpdate(t);
    };
    const onEnded = () => {
      setIsPlaying(false);
    };
    const onError = () => {
      // Extra debug info in renderer console
      const src = effectiveBaseSrc ?? '(no src)';
      console.error('[VIDEO] Error loading video source:', src);
      setHasError('Failed to load video. The file may have moved or is inaccessible.');
      setIsPlaying(false);
    };

    base.addEventListener('loadedmetadata', onLoadedMetadata);
    base.addEventListener('timeupdate', onTimeUpdate);
    base.addEventListener('ended', onEnded);
    base.addEventListener('error', onError);

    return () => {
      base.removeEventListener('loadedmetadata', onLoadedMetadata);
      base.removeEventListener('timeupdate', onTimeUpdate);
      base.removeEventListener('ended', onEnded);
      base.removeEventListener('error', onError);
    };
  }, [effectiveBaseSrc, onBaseMediaTimeUpdate]);

  // Drive playback from externalIsPlaying
  useEffect(() => {
    const base = baseVideoRef.current;
    const overlay = overlayVideoRef.current;
    if (!effectiveBaseSrc || hasError) return;
    const sync = async () => {
      try {
        if (typeof externalIsPlaying === 'boolean' && externalIsPlaying) {
          if (base) await base.play();
          if (overlay && overlaySrc) await overlay.play();
          setIsPlaying(true);
        } else {
          if (base) base.pause();
          if (overlay) overlay.pause();
          setIsPlaying(false);
        }
      } catch {
        // ignore play promise errors
      }
    };
    void sync();
  }, [externalIsPlaying, effectiveBaseSrc, overlaySrc, hasError]);

  // Seek to externalTime (only when drift is noticeable)
  useEffect(() => {
    const base = baseVideoRef.current;
    if (!base || effectiveBaseSrc == null || hasError) return;
    if (typeof baseExternalTime !== 'number' || !isFinite(baseExternalTime)) return;
    const drift = Math.abs((base.currentTime ?? 0) - baseExternalTime);
    if (drift > 0.2) {
      try {
        base.currentTime = Math.max(0, baseExternalTime);
        setCurrentTime(Math.max(0, baseExternalTime));
      } catch {}
    }
  }, [baseExternalTime, effectiveBaseSrc, hasError]);

  // Sync overlay current time when provided
  useEffect(() => {
    const overlay = overlayVideoRef.current;
    if (!overlay || overlaySrc == null) return;
    if (typeof overlayExternalTime !== 'number' || !isFinite(overlayExternalTime)) return;
    try {
      overlay.currentTime = Math.max(0, overlayExternalTime);
    } catch {}
  }, [overlayExternalTime, overlaySrc]);

  // Mute routing based on selected audio source
  useEffect(() => {
    const base = baseVideoRef.current;
    const overlay = overlayVideoRef.current;
    if (base) {
      base.muted = audioSource !== 'track1';
      base.volume = volume;
    }
    if (overlay) {
      overlay.muted = audioSource !== 'track2';
      overlay.volume = volume;
    }
  }, [audioSource, volume]);

  const progress = useMemo(() => {
    if (!duration || !isFinite(duration)) return 0;
    return Math.max(0, Math.min(100, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  const togglePlay = async () => {
    const video = baseVideoRef.current;
    if (!video || !effectiveBaseSrc || hasError) return;
    // If external control is present, delegate to timeline store as single source of truth
    if (typeof externalIsPlaying === 'boolean') {
      try {
        if (externalIsPlaying) {
          pauseTimeline();
        } else {
          playTimeline();
        }
      } catch {}
      return;
    }
    // Fallback: local control when not externally driven
    try {
      if (isPlaying) {
        video.pause();
        setIsPlaying(false);
      } else {
        await video.play();
        setIsPlaying(true);
      }
    } catch (e) {
      setHasError('Unable to play the video.');
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = baseVideoRef.current;
    if (!video || !duration) return;
    const percentage = Number(e.target.value);
    const newTime = (percentage / 100) * duration;
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Math.max(0, Math.min(1, Number(e.target.value)));
    setVolume(vol);
    // volumes applied via effect
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-6 h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <span>🎞️</span>
          <span>Video Preview</span>
        </h2>
        <p className="text-gray-600 text-sm">Select a clip to preview and use the controls to play, seek, and adjust volume.</p>
      </div>

      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
        {hasError ? (
          <div className="absolute inset-0 flex items-center justify-center text-red-600 text-sm p-4 text-center">
            {hasError}
          </div>
        ) : null}

        {/* Base video (Track 1) */}
        <video ref={baseVideoRef} controls className="w-full h-full">
          {effectiveBaseSrc ? <source src={effectiveBaseSrc} /> : null}
        </video>

        {/* Overlay video (Track 2) */}
        {overlaySrc ? (
          <video
            ref={overlayVideoRef}
            className="absolute rounded-lg shadow-lg"
            style={{ width: 240, height: 'auto', right: 16, bottom: 16 }}
            muted={audioSource !== 'track2'}
          >
            <source src={overlaySrc} />
          </video>
        ) : null}
      </div>

      {/* Controls */}
      <div className="mt-4 space-y-3">
        {/* Audio source toggle */}
        <div className="flex items-center gap-4 text-sm text-gray-700">
          <span className="text-gray-700">🔈 Audio source</span>
          <label className="inline-flex items-center gap-1">
            <input
              type="radio"
              name="audio-source"
              value="track1"
              checked={audioSource === 'track1'}
              onChange={() => setAudioSource('track1')}
              className="accent-blue-600"
            />
            <span>Track 1</span>
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              type="radio"
              name="audio-source"
              value="track2"
              checked={audioSource === 'track2'}
              onChange={() => setAudioSource('track2')}
              className="accent-blue-600"
            />
            <span>Track 2</span>
          </label>
        </div>
        {/* Time and progress */}
        <div className="flex items-center justify-between text-sm text-gray-700">
          <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
          <span className="text-gray-400">{effectiveBaseSrc ? '' : 'No clip selected'}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={progress}
          onChange={handleSeek}
          disabled={!effectiveBaseSrc || !duration || !!hasError}
          className="w-full accent-blue-600"
        />

        {/* Volume */}
        <div className="flex items-center gap-3">
          <span className="text-gray-700 text-sm">🔊 Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolume}
            className="w-full accent-blue-600"
          />
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;


