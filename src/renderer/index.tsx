/**
 * ClipForge - Renderer Process Entry Point
 * 
 * This file initializes the React application and mounts it to the DOM.
 * It runs in the renderer process (separate from the main Electron process).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import MediaLibrary from './components/MediaLibrary';
import VideoPlayer from './components/VideoPlayer';
import Timeline from './components/Timeline';
import { MediaClip } from '../types/media';
import { useTimelineStore } from './stores/timelineStore';
import { useMediaStore } from './stores/mediaStore';

/**
 * App Component - Main application component with Tailwind styling
 * 
 * This is a test component to verify that:
 * 1. React is properly installed and rendering
 * 2. Tailwind CSS is configured and applying styles
 * 3. All dependencies are loaded correctly
 */
const App: React.FC = () => {
  const [selectedClip, setSelectedClip] = useState<MediaClip | null>(null);
  const playerSrc = useMemo(() => (selectedClip ? `file://${selectedClip.path}` : null), [selectedClip]);

  // Timeline selectors/actions
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const currentTime = useTimelineStore((s) => s.currentTime);
  const play = useTimelineStore((s) => s.play);
  const pause = useTimelineStore((s) => s.pause);
  const setCurrentTime = useTimelineStore((s) => s.setCurrentTime);
  const getTimelineEnd = useTimelineStore((s) => s.getTimelineEnd);
  const timelineClips = useTimelineStore((s) => s.clips);
  const mediaClips = useMediaStore((s) => s.clips);

  // Active clip computation per track
  // **EXPLANATION**: This optimizes finding which clip is currently playing on each track.
  // We use useMemo to avoid recalculating this on every render - it only recalculates
  // when timelineClips, mediaClips, or currentTime changes.
  const { active1, active2 } = useMemo(() => {
    const findActiveForTrack = (trackId: number) => {
      // Find all clips at current playback time for this track
      // Then select the earliest-starting one (deterministic behavior when clips overlap)
      const overlappingClips = timelineClips.filter(
        (c) => c.trackId === trackId && currentTime >= c.startTime && currentTime < c.endTime
      );
      
      // Sort by startTime (earliest first) and take the first one
      // This ensures deterministic selection: the clip that started earliest is active
      const clip = overlappingClips.length > 0
        ? overlappingClips.sort((a, b) => a.startTime - b.startTime)[0]
        : null;
      
      const media = clip ? mediaClips.find((m) => m.id === clip.mediaId) ?? null : null;
      let mediaTime = 0;
      
      if (clip) {
        const withinClip = Math.max(0, currentTime - clip.startTime);
        mediaTime = Math.max(clip.trimStart, Math.min(clip.trimEnd, clip.trimStart + withinClip));
      }
      
      return { clip, media, mediaTime } as const;
    };
    
    return { active1: findActiveForTrack(1), active2: findActiveForTrack(2) };
  }, [timelineClips, mediaClips, currentTime]);

  // Playback controller (rAF) — only advances during gaps; inside a clip, let <video> clock drive
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const end = getTimelineEnd();
      // If currently inside a clip, do not manually advance; video onTimeUpdate feeds store
      const inAnyNow = timelineClips.some((c) => currentTime >= c.startTime && currentTime < c.endTime);
      if (inAnyNow) {
        // Still schedule next frame to handle exit conditions
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      let nextT = currentTime + dt;
      if (nextT >= end) {
        setCurrentTime(end);
        pause();
        return;
      }
      // Gap auto-skip
      const inAny = timelineClips.some((c) => nextT >= c.startTime && nextT < c.endTime);
      if (!inAny) {
        const futureStarts = timelineClips
          .map((c) => c.startTime)
          .filter((s) => s > nextT)
          .sort((a, b) => a - b);
        if (futureStarts.length) {
          nextT = futureStarts[0];
        } else {
          setCurrentTime(end);
          pause();
          return;
        }
      }
      setCurrentTime(nextT);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isPlaying, currentTime, timelineClips, getTimelineEnd, pause, setCurrentTime]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Main workspace: Media Library (left) and Video Player (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <MediaLibrary
            onSelectClip={(clip) => setSelectedClip(clip)}
            selectedClipId={selectedClip?.id ?? null}
          />
          <VideoPlayer
            baseSrc={active1.media ? `file://${active1.media.path}` : null}
            baseSubtitlesPath={active1.media?.subtitlesPath ?? null}
            overlaySrc={active2.media ? `file://${active2.media.path}` : null}
            externalIsPlaying={isPlaying}
            baseExternalTime={active1.clip ? active1.mediaTime : null}
            overlayExternalTime={active2.clip ? active2.mediaTime : null}
            onBaseMediaTimeUpdate={(t) => {
              if (active1.clip) {
                const clamped = Math.max(active1.clip.trimStart, Math.min(active1.clip.trimEnd, t));
                const offset = clamped - active1.clip.trimStart;
                const abs = active1.clip.startTime + offset;
                setCurrentTime(abs);
              }
            }}
          />
        </div>

        {/* Timeline below the main workspace */}
        <Timeline durationSec={Math.max(getTimelineEnd(), selectedClip?.duration ?? 120)} />
      </div>
    </div>
  );
};


/**
 * Initialize React Application
 * 
 * This code:
 * 1. Gets the root DOM element from index.html
 * 2. Creates a React root using the new React 18 API
 * 3. Renders the App component into the root element
 */
const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find root element. Make sure index.html has a <div id="root"></div>');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Expose timeline store for DevTools testing in development only
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).timeline = useTimelineStore;
}
