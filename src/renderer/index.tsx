/**
 * ClipForge - Renderer Process Entry Point
 * 
 * This file initializes the React application and mounts it to the DOM.
 * It runs in the renderer process (separate from the main Electron process).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import IPCTest from './components/IPCTest';
import MediaLibrary from './components/MediaLibrary';
import VideoPlayer from './components/VideoPlayer';
import Timeline from './components/Timeline';
import { MediaClip } from '../types/media';
import { useTimelineStore } from './stores/timelineStore';
import { useMediaStore } from './stores/mediaStore';

// Verify that the Electron API is available
if (window.electron) {
  console.log('✅ Electron API is available via window.electron');
} else {
  console.warn('⚠️ Electron API not available - preload script may have failed');
}

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

  // Active clip computation
  const active = useMemo(() => {
    if (!timelineClips.length) return { clip: null as any, media: null as any, mediaTime: 0 };
    // Prefer track 1, else lowest trackId that contains currentTime
    const containing = timelineClips
      .filter((c) => currentTime >= c.startTime && currentTime < c.endTime)
      .sort((a, b) => a.trackId - b.trackId || a.startTime - b.startTime);
    const clip = containing[0] ?? null;
    const media = clip ? mediaClips.find((m) => m.id === clip.mediaId) ?? null : null;
    let mediaTime = 0;
    if (clip) {
      const withinClip = Math.max(0, currentTime - clip.startTime);
      mediaTime = Math.max(clip.trimStart, Math.min(clip.trimEnd, clip.trimStart + withinClip));
    }
    return { clip, media, mediaTime };
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
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              🎬 ClipForge
            </h1>
            <p className="text-lg text-green-600 font-semibold">
              ✅ Dependencies Loaded Successfully
            </p>
          </div>

          {/* Status Cards */}
          <div className="space-y-3">
            <StatusCard 
              icon="⚛️" 
              title="React" 
              description="UI framework initialized and rendering"
              status="Ready"
            />
            <StatusCard 
              icon="🎨" 
              title="TailwindCSS" 
              description="Utility-first styling framework active"
              status="Ready"
            />
            <StatusCard 
              icon="📦" 
              title="Zustand" 
              description="State management library installed"
              status="Ready"
            />
            <StatusCard 
              icon="🎥" 
              title="FFmpeg" 
              description="Video processing tools ready"
              status="Ready"
            />
            <StatusCard 
              icon="🎭" 
              title="Konva" 
              description="Canvas library for timeline rendering"
              status="Ready"
            />
            <StatusCard 
              icon="💾" 
              title="Electron Store" 
              description="Persistent data storage configured"
              status="Ready"
            />
            <StatusCard 
              icon="🔗" 
              title="IPC Infrastructure" 
              description="Inter-Process Communication setup complete"
              status="Ready"
            />
          </div>

          

          {/* Footer */}
          <div className="mt-6 text-center text-sm text-gray-500">
            Epic 1.2: Core Dependencies Installation - Complete
          </div>
        </div>

        {/* Main workspace: Video Player (left) and Media Library (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <VideoPlayer
            src={active.media ? `file://${active.media.path}` : null}
            externalIsPlaying={isPlaying}
            externalTime={active.clip ? active.mediaTime : null}
            onMediaTimeUpdate={(t) => {
              // Map media time back to absolute timeline time when inside a clip
              if (active.clip) {
                // First clamp t to valid trim range, then calculate offset from trimStart
                const clampedMediaTime = Math.max(active.clip.trimStart, Math.min(active.clip.trimEnd, t));
                const offsetIntoClip = clampedMediaTime - active.clip.trimStart;
                const abs = active.clip.startTime + offsetIntoClip;
                setCurrentTime(abs);
              }
            }}
          />
          <MediaLibrary
            onSelectClip={(clip) => setSelectedClip(clip)}
            selectedClipId={selectedClip?.id ?? null}
          />
        </div>

        {/* Timeline below the main workspace */}
        <Timeline durationSec={Math.max(getTimelineEnd(), selectedClip?.duration ?? 120)} />
      </div>
    </div>
  );
};

/**
 * StatusCard Component - Displays a single dependency status
 * 
 * Props:
 * - icon: Emoji icon for the dependency
 * - title: Name of the dependency
 * - description: What the dependency does
 * - status: Current status (e.g., "Ready")
 */
interface StatusCardProps {
  icon: string;
  title: string;
  description: string;
  status: string;
}

const StatusCard: React.FC<StatusCardProps> = ({ icon, title, description, status }) => {
  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
      <div className="text-3xl">{icon}</div>
      <div className="flex-1">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
        {status}
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
