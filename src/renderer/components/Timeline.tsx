import React, { useMemo, useRef, useCallback } from 'react';
import { Stage, Layer, Line, Rect, Text, Group } from 'react-konva';
import { useTimelineStore } from '../stores/timelineStore';
import { useMediaStore } from '../stores/mediaStore';
import { TimelineClip } from '../../types/timeline';

interface TimelineProps {
  /**
   * Timeline total duration in seconds. If not provided, defaults to 120s.
   */
  durationSec?: number;
}

/**
 * WHY THIS COMPONENT EXISTS
 * - Renders the timeline canvas using react-konva/konva
 * - Shows a time ruler, labels, and a draggable playhead
 * - Provides zoom controls that scale pixels-per-second
 *
 * WHAT IT DOES
 * - Draws minor (1s) and major (10s) ticks with MM:SS labels
 * - Implements a vertical red playhead constrained to horizontal dragging
 * - Enables zoom in/out (1x..10x), with horizontal overflow scroll
 */
const Timeline: React.FC<TimelineProps> = ({ durationSec = 120 }) => {
  const BASE_PX_PER_SEC = 10; // base density at 1x zoom
  const TIMELINE_HEIGHT = 300;
  const RULER_HEIGHT = 30;
  const MAJOR_TICK_HEIGHT = 14;
  const MINOR_TICK_HEIGHT = 8;

  const zoomLevel = useTimelineStore((s) => s.zoomLevel);
  const playheadPosition = useTimelineStore((s) => s.playheadPosition);
  const setZoom = useTimelineStore((s) => s.setZoomLevel);
  const setPlayhead = useTimelineStore((s) => s.setCurrentTime);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const play = useTimelineStore((s) => s.play);
  const pause = useTimelineStore((s) => s.pause);
  const addClipToTimeline = useTimelineStore((s) => s.addClipToTimeline);
  const selectedTimelineClipId = useTimelineStore((s) => s.selectedClipId);
  const selectTimelineClip = useTimelineStore((s) => s.selectTimelineClip);
  const updateClip = useTimelineStore((s) => s.updateClip);
  const timelineClips = useTimelineStore((s) => s.clips);
  const mediaClips = useMediaStore((s) => s.clips);

  const pixelsPerSecond = BASE_PX_PER_SEC * zoomLevel;
  // Force static 2-minute timeline regardless of first clip (per request)
  const totalSeconds = 120;
  const roundedTo10 = Math.ceil(totalSeconds / 10) * 10;
  const stageWidth = Math.max(1, Math.ceil(roundedTo10 * pixelsPerSecond));

  const playheadX = Math.max(0, Math.min(stageWidth, playheadPosition * pixelsPerSecond));

  // Scroll container ref to preserve playhead screen position during zoom
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const containerRef = scrollRef; // alias for clarity below

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  const minorTicks = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    for (let s = 0; s <= roundedTo10; s += 1) {
      const x = s * pixelsPerSecond;
      nodes.push(
        <Line
          key={`minor-${s}`}
          points={[x, 0, x, MINOR_TICK_HEIGHT]}
          stroke="#e5e7eb" // gray-200
          strokeWidth={1}
        />
      );
    }
    return nodes;
  }, [pixelsPerSecond, roundedTo10]);

  const majorTicksAndLabels = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    for (let s = 0; s <= roundedTo10; s += 10) {
      const x = s * pixelsPerSecond;
      nodes.push(
        <Group key={`major-${s}`}>
          <Line
            points={[x, 0, x, MAJOR_TICK_HEIGHT]}
            stroke="#9ca3af" // gray-400
            strokeWidth={1}
          />
          <Text
            x={x + 4}
            y={MAJOR_TICK_HEIGHT + 2}
            text={formatTime(s)}
            fontSize={12}
            fill="#6b7280" // gray-500
          />
        </Group>
      );
    }
    return nodes;
  }, [pixelsPerSecond, roundedTo10]);

  const adjustZoom = (newZoom: number) => {
    const clamped = Math.max(1, Math.min(10, newZoom));
    if (clamped === zoomLevel) return;

    const container = scrollRef.current;
    const viewportWidth = container?.clientWidth ?? 0;
    const oldPixelsPerSecond = pixelsPerSecond; // before change
    const oldPlayheadX = playheadPosition * oldPixelsPerSecond;
    const oldScrollLeft = container?.scrollLeft ?? 0;
    const playheadViewportX = oldPlayheadX - oldScrollLeft;

    const newPixelsPerSecond = BASE_PX_PER_SEC * clamped;
    const newStageWidth = Math.max(1, Math.ceil(roundedTo10 * newPixelsPerSecond));
    const newPlayheadX = playheadPosition * newPixelsPerSecond;
    const desiredScrollLeft = Math.max(0, Math.min(Math.max(0, newStageWidth - viewportWidth), newPlayheadX - playheadViewportX));

    setZoom(clamped);
    if (container) {
      // Ensure scroll aligns so playhead stays visually in same screen position
      container.scrollLeft = desiredScrollLeft;
    }
  };

  const onZoomOut = () => {
    adjustZoom(zoomLevel - 1);
  };

  const onZoomIn = () => {
    adjustZoom(zoomLevel + 1);
  };

  // Helpers to map screen coords to timeline time/track
  const getDropContext = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return null;
    const bounds = container.getBoundingClientRect();
    const xInContainer = clientX - bounds.left + (container.scrollLeft ?? 0);
    const yInContainer = clientY - bounds.top;

    // Convert X to time
    const rawTime = xInContainer / pixelsPerSecond;
    const time = Math.max(0, Math.min(roundedTo10, Math.round(rawTime * 10) / 10));

    // Determine track by Y (simple 2 tracks below ruler)
    const trackAreaTop = RULER_HEIGHT + 10;
    const trackHeight = 100; // per track visual lane
    let trackId = 1;
    if (yInContainer >= trackAreaTop + trackHeight) {
      trackId = 2;
    } else {
      trackId = 1;
    }

    return { time, trackId };
  }, [containerRef, pixelsPerSecond, roundedTo10]);

  // HTML5 DnD handlers on outer scroll container
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const data = e.dataTransfer.getData('application/clipforge-media');
    if (!data) return;
    let payload: { mediaId: string; duration: number; filename: string } | null = null;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }
    if (!payload) return;

    const ctx = getDropContext(e.clientX, e.clientY);
    if (!ctx) return;

    const duration = Math.max(0, payload.duration ?? 0);
    const startTime = ctx.time;
    const endTime = Math.min(roundedTo10, startTime + duration);

    const newClip: TimelineClip = {
      id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      mediaId: payload.mediaId,
      trackId: ctx.trackId,
      startTime,
      endTime,
      trimStart: 0,
      trimEnd: Math.min(duration, endTime - startTime),
    };
    addClipToTimeline(newClip);
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      {/* Header & Controls */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-800">🧭 Timeline</h2>
          <span className="text-sm text-gray-500">Duration: {formatTime(totalSeconds)}</span>
          <span className="text-sm text-gray-500">| Current: {playheadPosition.toFixed(2)}s</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => (isPlaying ? pause() : play())}
            className={`px-3 py-1 rounded ${isPlaying ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            title={isPlaying ? 'Pause (timeline)' : 'Play (timeline)'}
          >
            {isPlaying ? 'Pause ⏸' : 'Play ▶'}
          </button>
          <button
            onClick={onZoomOut}
            className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
            title="Zoom Out"
          >
            −
          </button>
          <span className="text-sm text-gray-600 w-16 text-center">{zoomLevel}x</span>
          <button
            onClick={onZoomIn}
            className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
            title="Zoom In"
          >
            +
          </button>
        </div>
      </div>

      {/* Scrollable canvas container & drop zone */}
      <div
        ref={scrollRef}
        className="overflow-x-auto w-full border border-gray-200 rounded-lg bg-gray-50"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div style={{ width: stageWidth }}>
          <Stage width={stageWidth} height={TIMELINE_HEIGHT}>
            <Layer>
              {/* Background */}
              <Rect x={0} y={0} width={stageWidth} height={TIMELINE_HEIGHT} fill="#f9fafb" />

              {/* Ruler area */}
              <Group x={0} y={0}>
                {/* Minor ticks every 1s */}
                {minorTicks}
                {/* Major ticks and labels every 10s */}
                {majorTicksAndLabels}
                {/* Separator under ruler */}
                <Line points={[0, RULER_HEIGHT, stageWidth, RULER_HEIGHT]} stroke="#e5e7eb" strokeWidth={1} />
              </Group>

              {/* Timeline Clips */}
              {timelineClips.map((clip) => {
                const x = clip.startTime * pixelsPerSecond;
                const width = Math.max(1, (clip.endTime - clip.startTime) * pixelsPerSecond);
                const trackAreaTop = RULER_HEIGHT + 10;
                const trackHeight = 100;
                const y = clip.trackId === 2 ? trackAreaTop + trackHeight : trackAreaTop;
                const media = mediaClips.find((m) => m.id === clip.mediaId);
                const label = media?.filename ?? clip.mediaId;
                const isSelected = selectedTimelineClipId === clip.id;
                const fill = clip.trackId === 1 ? '#bfdbfe' : '#fde68a'; // blue-200 / amber-200
                const stroke = isSelected ? '#2563eb' : '#9ca3af'; // blue-600 or gray-400

                return (
                  <Group
                    key={clip.id}
                    x={x}
                    y={y}
                    draggable
                    dragBoundFunc={(pos) => {
                      const clampedX = Math.max(0, Math.min(stageWidth - width, pos.x));
                      return { x: clampedX, y };
                    }}
                    onClick={() => selectTimelineClip(clip.id)}
                    onDragEnd={(e) => {
                      const newX = e.target.x();
                      const newStart = Math.round((newX / pixelsPerSecond) * 10) / 10;
                      const durationSec = clip.endTime - clip.startTime;
                      const newEnd = Math.min(roundedTo10, newStart + durationSec);
                      updateClip(clip.id, { startTime: newStart, endTime: newEnd });
                    }}
                  >
                    <Rect
                      x={0}
                      y={0}
                      width={width}
                      height={trackHeight - 10}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={isSelected ? 3 : 1}
                      cornerRadius={6}
                      shadowColor={'#000'}
                      shadowBlur={isSelected ? 8 : 2}
                      shadowOpacity={0.1}
                    />
                    <Text
                      x={8}
                      y={8}
                      text={label}
                      fontSize={12}
                      fill="#374151"
                    />
                  </Group>
                );
              })}

              {/* Playhead - draggable group with larger handle for easier interaction */}
              <Group
                x={playheadX}
                y={0}
                draggable
                dragBoundFunc={(pos) => {
                  const clampedX = Math.max(0, Math.min(stageWidth, pos.x));
                  return { x: clampedX, y: 0 };
                }}
                onDragMove={(e) => {
                  const x = e.target.x();
                  const time = Math.max(0, Math.min(roundedTo10, x / pixelsPerSecond));
                  const snapped = Math.round(time * 10) / 10; // snap 0.1s
                  setPlayhead(snapped);
                }}
              >
                {/* Vertical line */}
                <Line
                  points={[0, 0, 0, TIMELINE_HEIGHT]}
                  stroke="#ef4444" // red-500
                  strokeWidth={2}
                  hitStrokeWidth={14}
                />
                {/* Handle near the top for better hit target */}
                <Rect
                  x={-8}
                  y={4}
                  width={16}
                  height={16}
                  fill="#ef4444"
                  cornerRadius={4}
                  shadowColor={'#ef4444'}
                  shadowBlur={4}
                  shadowOpacity={0.4}
                />
              </Group>
            </Layer>
          </Stage>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 text-center text-xs text-gray-500">
        Epic 3.1: Timeline UI (Konva Canvas)
      </div>
    </div>
  );
};

export default Timeline;


