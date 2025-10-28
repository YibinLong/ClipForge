import React, { useMemo, useRef, useState } from 'react';
import { Stage, Layer, Line, Rect, Text, Group } from 'react-konva';

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

  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);

  const pixelsPerSecond = BASE_PX_PER_SEC * zoomLevel;
  const totalSeconds = Math.max(0, Math.ceil(durationSec));
  const roundedTo10 = Math.ceil(totalSeconds / 10) * 10;
  const stageWidth = Math.max(1, Math.ceil(roundedTo10 * pixelsPerSecond));

  const playheadX = Math.max(0, Math.min(stageWidth, currentTimeSec * pixelsPerSecond));

  // Scroll container ref to preserve playhead screen position during zoom
  const scrollRef = useRef<HTMLDivElement | null>(null);

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  const minorTicks = useMemo(() => {
    const nodes: JSX.Element[] = [];
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
    const nodes: JSX.Element[] = [];
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
    const oldPlayheadX = currentTimeSec * oldPixelsPerSecond;
    const oldScrollLeft = container?.scrollLeft ?? 0;
    const playheadViewportX = oldPlayheadX - oldScrollLeft;

    const newPixelsPerSecond = BASE_PX_PER_SEC * clamped;
    const newStageWidth = Math.max(1, Math.ceil(roundedTo10 * newPixelsPerSecond));
    const newPlayheadX = currentTimeSec * newPixelsPerSecond;
    const desiredScrollLeft = Math.max(0, Math.min(Math.max(0, newStageWidth - viewportWidth), newPlayheadX - playheadViewportX));

    setZoomLevel(clamped);
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

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      {/* Header & Controls */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-800">🧭 Timeline</h2>
          <span className="text-sm text-gray-500">Duration: {formatTime(totalSeconds)}</span>
          <span className="text-sm text-gray-500">| Current: {currentTimeSec.toFixed(2)}s</span>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Scrollable canvas container */}
      <div ref={scrollRef} className="overflow-x-auto w-full border border-gray-200 rounded-lg bg-gray-50">
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
                  setCurrentTimeSec(snapped);
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


