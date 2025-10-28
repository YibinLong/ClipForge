import React, { useEffect, useMemo, useRef, useState } from 'react';

interface VideoPlayerProps {
  /** Absolute file URL using file:// scheme, or null when nothing selected */
  src: string | null;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [hasError, setHasError] = useState<string | null>(null);

  // Reset player state when src changes
  useEffect(() => {
    const video = videoRef.current;
    setHasError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    if (video) {
      try {
        video.pause();
        // Force reload of media element source
        // Using load() ensures metadata events fire when src updates
        video.load();
      } catch {}
    }
  }, [src]);

  // Attach media event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoadedMetadata = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0);
    };
    const onTimeUpdate = () => {
      setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0);
    };
    const onEnded = () => {
      setIsPlaying(false);
    };
    const onError = () => {
      setHasError('Failed to load video. The file may have moved or is inaccessible.');
      setIsPlaying(false);
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
    };
  }, [src]);

  const progress = useMemo(() => {
    if (!duration || !isFinite(duration)) return 0;
    return Math.max(0, Math.min(100, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video || !src || hasError) return;
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
    const video = videoRef.current;
    if (!video || !duration) return;
    const percentage = Number(e.target.value);
    const newTime = (percentage / 100) * duration;
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    const vol = Math.max(0, Math.min(1, Number(e.target.value)));
    setVolume(vol);
    if (video) {
      video.volume = vol;
    }
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

        <video
          ref={videoRef}
          controls
          className="w-full h-full"
        >
          {src ? <source src={src} /> : null}
        </video>

        {/* Overlay play/pause button */}
        <button
          type="button"
          onClick={togglePlay}
          disabled={!src || !!hasError}
          className={`absolute inset-0 m-auto h-16 w-16 flex items-center justify-center rounded-full shadow-lg transition
            ${!src || hasError ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'}
          `}
          style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          <span className="text-white text-3xl">{isPlaying ? '❚❚' : '▶'}</span>
        </button>
      </div>

      {/* Controls */}
      <div className="mt-4 space-y-3">
        {/* Time and progress */}
        <div className="flex items-center justify-between text-sm text-gray-700">
          <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
          <span className="text-gray-400">{src ? '' : 'No clip selected'}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={progress}
          onChange={handleSeek}
          disabled={!src || !duration || !!hasError}
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


