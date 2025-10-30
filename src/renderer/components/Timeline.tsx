import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { Stage, Layer, Line, Rect, Text, Group, Image as KonvaImage } from 'react-konva';
import { useTimelineStore } from '../stores/timelineStore';
import { useMediaStore } from '../stores/mediaStore';
import { TimelineClip } from '../../types/timeline';
import ExportModal from './ExportModal';

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
  const TRACK_LABEL_WIDTH = 80;
  const TRACK_HEIGHT = 100;
  const TRACK_GAP = 10;
  const MAJOR_TICK_HEIGHT = 14;
  const MINOR_TICK_HEIGHT = 8;
  const HANDLE_W = 6; // Trim handle width (reduced from 8 for cleaner look)
  const DEBUG_TRIM = true;

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
  const removeClipFromTimeline = useTimelineStore((s) => s.removeClipFromTimeline);
  const updateClip = useTimelineStore((s) => s.updateClip);
  const moveClipToTrack = useTimelineStore((s) => s.moveClipToTrack);
  const rippleTrimStart = useTimelineStore((s) => s.rippleTrimStart);
  const rippleTrimEnd = useTimelineStore((s) => s.rippleTrimEnd);
  const splitClip = useTimelineStore((s) => s.splitClip);
  const timelineClips = useTimelineStore((s) => s.clips);
  const mediaClips = useMediaStore((s) => s.clips);
  const [exportOpen, setExportOpen] = useState(false);
  const [hoverTip, setHoverTip] = useState<{
    visible: boolean;
    text: string;
    x: number;
    y: number;
  }>({ visible: false, text: '', x: 0, y: 0 });
  const [isDraggingClip, setIsDraggingClip] = useState(false);
  
  // Cache for loaded thumbnail images (mediaId -> HTMLImageElement)
  const [thumbnailImages, setThumbnailImages] = useState<Map<string, HTMLImageElement>>(new Map());

  // Load thumbnail images for all media clips
  // **EXPLANATION**: This effect loads thumbnail images into memory so we can display them in timeline clips.
  // We use file:// protocol (same as in MediaLibrary) to access local thumbnail files.
  // The effect only depends on mediaClips - when new media is added, we load its thumbnail.
  // We removed thumbnailImages from dependencies to prevent infinite loop (since we update it inside the effect).
  useEffect(() => {
    mediaClips.forEach((media) => {
      if (!media.thumbnail) return;
      if (thumbnailImages.has(media.id)) return; // Already loaded
      
      const img = new Image();
      img.onload = () => {
        setThumbnailImages((prev) => {
          const newMap = new Map(prev);
          newMap.set(media.id, img);
          return newMap;
        });
      };
      img.onerror = () => {
        console.warn(`[Timeline] Failed to load thumbnail for ${media.id}`);
      };
      img.src = `file://${media.thumbnail}`;
    });
  }, [mediaClips]);

  const pixelsPerSecond = BASE_PX_PER_SEC * zoomLevel;
  // Force static 2-minute timeline regardless of first clip (per request)
  const totalSeconds = 120;
  const roundedTo10 = Math.ceil(totalSeconds / 10) * 10;
  const stageWidth = Math.max(1, Math.ceil(roundedTo10 * pixelsPerSecond));

  const playheadX = Math.max(0, Math.min(stageWidth, playheadPosition * pixelsPerSecond));

  // Scroll container ref to preserve playhead screen position during zoom
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const containerRef = scrollRef; // alias for clarity below

  // Local drag state for trim handles to render live tooltips & bounds
  const [activeTrim, setActiveTrim] = useState<
    | null
    | {
        clipId: string;
        side: 'left' | 'right';
        proposedStartTime?: number; // absolute time in seconds
        proposedEndTime?: number; // absolute time in seconds
        proposedTrimStart?: number; // within-source seconds
        proposedTrimEnd?: number; // within-source seconds
        absX: number; // absolute x in pixels for tooltip placement
        absY: number; // absolute y (top of clip group) in pixels
      }
  >(null);

  // While a trim handle is being dragged, we suppress group dragging
  const isTrimmingRef = useRef(false);

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

  // Shared delete handler used by keyboard and toolbar button
  const handleDelete = useCallback(() => {
    if (!selectedTimelineClipId) return;
    const target = timelineClips.find((c) => c.id === selectedTimelineClipId) || null;
    const wasPlaying = isPlaying;
    removeClipFromTimeline(selectedTimelineClipId);
    selectTimelineClip(null);
    if (
      wasPlaying &&
      target &&
      playheadPosition >= target.startTime &&
      playheadPosition < target.endTime
    ) {
      pause();
    }
  }, [selectedTimelineClipId, timelineClips, isPlaying, removeClipFromTimeline, selectTimelineClip, playheadPosition, pause]);

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
    const trackHeight = TRACK_HEIGHT; // per track visual lane
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
    // Snap-to-start: if track is empty, snap to 0; otherwise snap to end of rightmost clip
    const existingOnTrack = timelineClips.filter((c) => c.trackId === ctx.trackId);
    
    let startTime: number;
    if (existingOnTrack.length === 0) {
      // Track is empty: snap to timeline start (0)
      startTime = 0;
    } else {
      // Track has clips: snap to the end of the rightmost clip
      const rightmostClip = existingOnTrack.reduce((max, c) => c.endTime > max.endTime ? c : max);
      startTime = rightmostClip.endTime;
    }
    
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
          {/* Split button */}
          {(() => {
            const MIN_CLIP_DURATION = 0.1;
            const candidates = timelineClips
              .filter((c) => playheadPosition >= c.startTime && playheadPosition < c.endTime)
              .sort((a, b) => a.trackId - b.trackId || a.startTime - b.startTime);
            const target = candidates[0] ?? null;
            const canSplit = !!target &&
              (playheadPosition - (target?.startTime ?? 0)) >= MIN_CLIP_DURATION &&
              ((target?.endTime ?? 0) - playheadPosition) >= MIN_CLIP_DURATION;
            return (
              <button
                onClick={() => target && splitClip(target.id, playheadPosition)}
                disabled={!canSplit}
                className={`px-3 py-1 rounded ${canSplit ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-60'}`}
                title={canSplit ? 'Split clip at playhead' : 'Move playhead inside a clip to split'}
              >
                Split ✂
              </button>
            );
          })()}
          {/* Delete button */}
          <button
            onClick={handleDelete}
            disabled={!selectedTimelineClipId}
            className={`px-3 py-1 rounded ${selectedTimelineClipId ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-60'}`}
            title={selectedTimelineClipId ? 'Delete selected clip (Del/Backspace)' : 'Select a clip to delete'}
          >
            Delete 🗑
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
          {(() => {
            const canExport = timelineClips.length > 0;
            return (
              <button
                onClick={() => setExportOpen(true)}
                disabled={!canExport}
                className={`px-3 py-1 rounded ${canExport ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-60'}`}
                title={canExport ? 'Export timeline to MP4' : 'Add a clip to export'}
              >
                Export ⤓
              </button>
            );
          })()}
        </div>
      </div>

      {/* Scrollable canvas container & drop zone */}
      <div
        ref={scrollRef}
        className="overflow-x-auto w-full border border-gray-200 rounded-lg bg-gray-50"
        tabIndex={0}
        role="region"
        aria-label="Timeline canvas. Use Delete or Backspace to remove selected clip."
        onMouseDown={() => {
          // Ensure the container is focused so it receives keyboard events
          scrollRef.current?.focus();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            e.stopPropagation();
            handleDelete();
          }
        }}
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

              {/* Track lanes & labels */}
              {(() => {
                const trackAreaTop = RULER_HEIGHT + 10;
                const y1 = trackAreaTop;
                const y2 = trackAreaTop + TRACK_HEIGHT;
                return (
                  <Group>
                    {/* Track 1 lane */}
                    <Rect x={0} y={y1} width={stageWidth} height={TRACK_HEIGHT - TRACK_GAP} fill="#f3f4f6" />
                    <Text x={6} y={y1 + 6} text="Track 1" fontSize={12} fill="#6b7280" />
                    {/* Track 2 lane */}
                    <Rect x={0} y={y2} width={stageWidth} height={TRACK_HEIGHT - TRACK_GAP} fill="#f3f4f6" />
                    <Text x={6} y={y2 + 6} text="Track 2" fontSize={12} fill="#6b7280" />
                  </Group>
                );
              })()}

              {/* Timeline Clips */}
              {timelineClips.map((clip) => {
                // VISUAL TRIM: Only show the trimmed (visible) portion of the clip
                // Position: where the clip starts on the timeline
                const x = clip.startTime * pixelsPerSecond;
                // Width: based on trimmed duration (what the user sees)
                const trimmedDuration = clip.trimEnd - clip.trimStart;
                const width = Math.max(1, trimmedDuration * pixelsPerSecond);
                
                const trackAreaTop = RULER_HEIGHT + 10;
                const trackHeight = TRACK_HEIGHT;
                const y1 = trackAreaTop;
                const y2 = trackAreaTop + trackHeight;
                const y = clip.trackId === 2 ? y2 : y1;
                const media = mediaClips.find((m) => m.id === clip.mediaId);
                const label = media?.filename ?? clip.mediaId;
                const isSelected = selectedTimelineClipId === clip.id;
                
                // DEBUG: Log clip visual calculation when selected (only once per render)
                if (DEBUG_TRIM && isSelected && Math.random() < 0.1) {
                  console.log('[TIMELINE][RENDER] Clip visual calculation:', {
                    clipId: clip.id,
                    timelineBounds: { start: clip.startTime, end: clip.endTime, duration: clip.endTime - clip.startTime },
                    trimBounds: { trimStart: clip.trimStart, trimEnd: clip.trimEnd, trimmedDuration },
                    visualRepresentation: { x, width, pixelsPerSecond },
                    note: 'VISUAL TRIM: width = (trimEnd - trimStart) * pixelsPerSecond (only showing trimmed portion)',
                  });
                }
                const fill = clip.trackId === 1 ? '#bfdbfe' : '#fde68a'; // blue-200 / amber-200
                const stroke = isSelected ? '#2563eb' : '#9ca3af'; // blue-600 or gray-400
                const minStep = 0.1; // seconds
                const minPixels = minStep * pixelsPerSecond;
                const absGroupX = x; // group absolute X in pixels
                const absGroupY = y; // group absolute Y in pixels

                const snap = (t: number) => Math.round(t * 10) / 10;
                const clamp = (val: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, val));

                const groupDraggable = !(activeTrim && activeTrim.clipId === clip.id) && !isTrimmingRef.current;
                return (
                  <Group
                    key={clip.id}
                    x={x}
                    y={y}
                    draggable={groupDraggable}
                    // NO clipping - allows trim handles to remain visible during recovery/untrim
                    onMouseEnter={(e) => {
                      if (isDraggingClip) return;
                      const stage = e.target.getStage();
                      const ptr = stage?.getPointerPosition();
                      if (ptr) setHoverTip({ visible: true, text: label, x: ptr.x + 12, y: ptr.y + 12 });
                    }}
                    onMouseMove={(e) => {
                      if (isDraggingClip) return;
                      const stage = e.target.getStage();
                      const ptr = stage?.getPointerPosition();
                      if (ptr && hoverTip.visible) setHoverTip((t) => ({ ...t, x: ptr.x + 12, y: ptr.y + 12 }));
                    }}
                    onMouseLeave={() => setHoverTip({ visible: false, text: '', x: 0, y: 0 })}
                    dragBoundFunc={(pos) => {
                      const clampedX = Math.max(0, Math.min(stageWidth - width, pos.x));
                      const trackAreaTopLocal = RULER_HEIGHT + 10;
                      const track1Y = trackAreaTopLocal;
                      const track2Y = trackAreaTopLocal + TRACK_HEIGHT;
                      const trackMidpoint = trackAreaTopLocal + (TRACK_HEIGHT / 2);
                      
                      // Snap to either track 1 or track 2 based on which is closer
                      // This prevents clips from appearing "stuck in the middle"
                      const snappedY = pos.y < trackMidpoint ? track1Y : track2Y;
                      return { x: clampedX, y: snappedY };
                    }}
                    onClick={() => selectTimelineClip(clip.id)}
                    onDragStart={(e) => {
                      if (isTrimmingRef.current) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (e.evt as any).cancelBubble = true;
                      }
                        setIsDraggingClip(true);
                        setHoverTip({ visible: false, text: '', x: 0, y: 0 });
                    }}
                    onDragEnd={(e) => {
                      setIsDraggingClip(false);
                      setHoverTip({ visible: false, text: '', x: 0, y: 0 });
                      if (isTrimmingRef.current) {
                        // ignore group drag end while trimming
                        return;
                      }
                      const newX = e.target.x();
                      const newY = e.target.y();
                      let newStart = Math.round((newX / pixelsPerSecond) * 10) / 10;
                      const durationSec = clip.endTime - clip.startTime;
                      
                      // Determine target track by final Y
                      const trackAreaTopLocal = RULER_HEIGHT + 10;
                      const targetTrackId = newY >= trackAreaTopLocal + TRACK_HEIGHT ? 2 : 1;
                      
                      // SMART SNAP logic: Snap to nearby clip edges to prevent gaps
                      // Exclude the clip being dragged from the calculation
                      const existingOnTrack = timelineClips.filter(c => c.trackId === targetTrackId && c.id !== clip.id);
                      
                      let snappedStart: number = newStart;
                      const SNAP_THRESHOLD = 2.0; // Snap if within 2 seconds of an edge
                      
                      if (existingOnTrack.length === 0) {
                        // Track is empty (or only has the dragged clip): snap to 0
                        snappedStart = 0;
                        console.log('[DRAG DEBUG] Track empty → snapping to 0');
                      } else {
                        // Find all clip edges (start and end times) on this track
                        const allEdges = existingOnTrack.flatMap(c => [c.startTime, c.endTime]);
                        
                        // Find the closest edge to our drag position
                        let closestEdge: { edge: number; distance: number } | null = null;
                        for (const edge of allEdges) {
                          const distance = Math.abs(edge - newStart);
                          if (distance <= SNAP_THRESHOLD && (!closestEdge || distance < closestEdge.distance)) {
                            closestEdge = { edge, distance };
                          }
                        }
                        
                        if (closestEdge) {
                          // Snap to the closest edge
                          snappedStart = closestEdge.edge;
                          console.log('[DRAG DEBUG] Snapping to nearby edge:', {
                            rawPosition: newStart,
                            closestEdge: closestEdge.edge,
                            distance: closestEdge.distance
                          });
                        } else {
                          // No nearby edges, keep the drag position as-is
                          snappedStart = newStart;
                          console.log('[DRAG DEBUG] No snap - too far from edges, keeping position:', newStart);
                        }
                      }
                      
                      const snappedEnd = Math.min(roundedTo10, snappedStart + durationSec);
                      console.log('[DRAG DEBUG] Final:', { snappedStart, snappedEnd, duration: durationSec });
                      
                      updateClip(clip.id, { startTime: snappedStart, endTime: snappedEnd });
                      if (clip.trackId !== targetTrackId) {
                        moveClipToTrack(clip.id, targetTrackId);
                      }
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
                    
                    {/* Thumbnail preview - repeating pattern */}
                    {(() => {
                      const thumbnailImg = thumbnailImages.get(clip.mediaId);
                      if (!thumbnailImg) {
                        // Fallback to text label if thumbnail not loaded yet
                        return (
                          <Text
                            x={8}
                            y={8}
                            text={label}
                            fontSize={12}
                            fill="#374151"
                            width={Math.max(0, width - 16)}
                            wrap={'none'}
                            ellipsis
                          />
                        );
                      }
                      
                      // Calculate thumbnail dimensions to fit in the clip height
                      const clipHeight = trackHeight - 10;
                      const thumbnailAspectRatio = thumbnailImg.width / thumbnailImg.height;
                      const thumbnailHeight = clipHeight - 4; // 2px padding top and bottom
                      const thumbnailWidth = thumbnailHeight * thumbnailAspectRatio;
                      
                      // Render repeating thumbnails to fill the clip width
                      const thumbnails = [];
                      let currentX = 2; // Start with 2px padding
                      let index = 0;
                      
                      while (currentX < width - 2 && index < 50) { // Max 50 thumbnails to prevent infinite loop
                        const remainingWidth = width - currentX - 2;
                        const displayWidth = Math.min(thumbnailWidth, remainingWidth);
                        
                        if (displayWidth > 0) {
                          thumbnails.push(
                            <KonvaImage
                              key={`thumb-${index}`}
                              x={currentX}
                              y={2}
                              width={displayWidth}
                              height={thumbnailHeight}
                              image={thumbnailImg}
                              crop={displayWidth < thumbnailWidth ? {
                                x: 0,
                                y: 0,
                                width: thumbnailImg.width * (displayWidth / thumbnailWidth),
                                height: thumbnailImg.height
                              } : undefined}
                            />
                          );
                        }
                        
                        currentX += thumbnailWidth;
                        index++;
                      }
                      
                      return thumbnails;
                    })()}

                    {/* LEFT Trim Handle - FIXED: Calculates delta from initial position (0) */}
                    <Rect
                      x={0}
                      y={0}
                      width={HANDLE_W}
                      height={trackHeight - 10}
                      fill={isSelected ? '#3b82f6' : '#6b7280'}
                      opacity={0.8}
                      draggable
                      onDragStart={(e) => {
                        isTrimmingRef.current = true;
                        const handleAbsX = e.target.getAbsolutePosition().x;
                        if (DEBUG_TRIM) {
                          console.log('[TRIM][LEFT][START]', {
                            clipId: clip.id,
                            clipBounds: { start: clip.startTime, end: clip.endTime },
                            trimBounds: { trimStart: clip.trimStart, trimEnd: clip.trimEnd },
                            handleStartPos: handleAbsX,
                            mediaDuration: media?.duration,
                          });
                        }
                        setActiveTrim({
                          clipId: clip.id,
                          side: 'left',
                          proposedStartTime: clip.startTime,
                          proposedTrimStart: clip.trimStart,
                          absX: handleAbsX,
                          absY: absGroupY,
                        });
                        setIsDraggingClip(true);
                        setHoverTip({ visible: false, text: '', x: 0, y: 0 });
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (e.evt as any).cancelBubble = true;
                      }}
                      onMouseDown={(e) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (e.evt as any).cancelBubble = true;
                      }}
                      dragBoundFunc={(pos) => {
                        // LEFT TRIM WITH RECOVERY: Handle can extend left to recover trimmed content
                        const localDesiredX = pos.x - absGroupX;
                        
                        // Minimum: can extend left by the amount previously trimmed
                        // If trimStart = 10s, we can go -10s * pixelsPerSecond to recover that content
                        const localMinX = -clip.trimStart * pixelsPerSecond;
                        
                        // Maximum: must maintain minimum clip width
                        const localMaxX = width - minPixels;
                        
                        const clampedLocalX = Math.max(localMinX, Math.min(localMaxX, localDesiredX));
                        const clampedAbsX = absGroupX + clampedLocalX;
                        
                        // DEBUG: Occasionally log constraints (throttled by random to avoid spam)
                        if (DEBUG_TRIM && Math.random() < 0.05) {
                          console.log('[TIMELINE][LEFT][dragBound] Constraining handle:', {
                            localDesiredX,
                            constraints: { localMinX, localMaxX, minPixels, width, trimStart: clip.trimStart },
                            result: { clampedLocalX, clampedAbsX },
                            note: 'LEFT TRIM WITH RECOVERY: can extend left to recover trimmed content',
                          });
                        }

                        return { x: clampedAbsX, y: absGroupY };
                      }}
                      onDragMove={(e) => {
                        const mediaDuration = media?.duration ?? (clip.trimEnd - clip.trimStart);
                        const handleAbsX = e.target.getAbsolutePosition().x;

                        // LEFT TRIM: Calculate based on absolute timeline position
                        const newTimelinePosition = snap(handleAbsX / pixelsPerSecond);
                        const amountCut = newTimelinePosition - clip.startTime;
                        
                        const proposedTrimStart = clamp(
                          snap(clip.trimStart + amountCut),
                          0,
                          Math.max(clip.trimStart, clip.trimEnd - minStep) // can't go past trimEnd
                        );

                        setActiveTrim({
                          clipId: clip.id,
                          side: 'left',
                          proposedStartTime: newTimelinePosition, // Where the clip will start on timeline
                          proposedTrimStart,
                          absX: handleAbsX,
                          absY: absGroupY,
                        });
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (e.evt as any).cancelBubble = true;
                      }}
                      onDragEnd={(e) => {
                        const mediaDuration = media?.duration ?? (clip.trimEnd - clip.trimStart);
                        const handleAbsX = e.target.getAbsolutePosition().x;
                        
                        // LEFT TRIM WITH RECOVERY: Calculate where the new left edge should be on timeline
                        // The handle's absolute position tells us where the clip should END UP starting
                        const newTimelinePosition = snap(handleAbsX / pixelsPerSecond);
                        
                        // How much we're cutting/recovering from the left
                        // Positive: cutting more (handle moved right)
                        // Negative: recovering content (handle moved left)
                        // Example: handle at 5s, clip started at 10s → amountCut = -5s (recovery!)
                        const amountCut = newTimelinePosition - clip.startTime;
                        const newTrimStart = clamp(
                          snap(clip.trimStart + amountCut),
                          0,
                          Math.max(0, clip.trimEnd - minStep) // can't trim past the end
                        );

                        if (DEBUG_TRIM) {
                          console.log('[TRIM][LEFT][END]', {
                            clipId: clip.id,
                            before: {
                              clipBounds: { start: clip.startTime, end: clip.endTime },
                              trimBounds: { trimStart: clip.trimStart, trimEnd: clip.trimEnd },
                            },
                            calculation: {
                              handleAbsX,
                              newTimelinePosition,
                              amountCut,
                              newTrimStart,
                            },
                            requested: {
                              clipBounds: { start: 'will be recalculated', end: clip.endTime },
                              trimBounds: { trimStart: newTrimStart, trimEnd: clip.trimEnd },
                            },
                            handleFinalPos: handleAbsX,
                            note: 'LEFT TRIM WITH RECOVERY: Right edge stays fixed, can recover previously trimmed content',
                          });
                        }

                        rippleTrimStart(clip.id, newTrimStart, media?.duration ?? null);
                        
                        // CRITICAL: Reset handle position to 0 (left edge of clip)
                        // After the store updates, the Group will move to the new startTime position
                        // The handle needs to stay at the left edge (x=0 in local coordinates)
                        e.target.x(0);
                        e.target.y(0);

                        setActiveTrim(null);
                        
                        // Delay clearing trim flag to prevent Group's onDragEnd from firing
                        // and incorrectly repositioning the clip
                        setTimeout(() => {
                          isTrimmingRef.current = false;
                        }, 100);

                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (e.evt as any).cancelBubble = true;
                      }}
                    />

                    {/* RIGHT Trim Handle */}
                    <Rect
                      x={Math.max(0, width - HANDLE_W)}
                      y={0}
                      width={HANDLE_W}
                      height={trackHeight - 10}
                      fill={isSelected ? '#1d4ed8' : '#4b5563'}
                      opacity={0.9}
                      draggable
                      onDragStart={(e) => {
                        isTrimmingRef.current = true;
                        const handleLeftAbsX = e.target.getAbsolutePosition().x;
                        const rightEdgeAbsX = handleLeftAbsX + HANDLE_W;
                        if (DEBUG_TRIM) {
                          console.log('[TRIM][RIGHT][START]', {
                            clipId: clip.id,
                            clipBounds: { start: clip.startTime, end: clip.endTime },
                            trimBounds: { trimStart: clip.trimStart, trimEnd: clip.trimEnd },
                            handleStartPos: rightEdgeAbsX,
                            mediaDuration: media?.duration,
                          });
                        }
                        setActiveTrim({
                          clipId: clip.id,
                          side: 'right',
                          proposedEndTime: snap(rightEdgeAbsX / pixelsPerSecond),
                          proposedTrimEnd: clip.trimEnd,
                          absX: rightEdgeAbsX,
                          absY: absGroupY,
                        });
                        setIsDraggingClip(true);
                        setHoverTip({ visible: false, text: '', x: 0, y: 0 });
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (e.evt as any).cancelBubble = true;
                      }}
                      onMouseDown={(e) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (e.evt as any).cancelBubble = true;
                      }}
                      dragBoundFunc={(pos) => {
                        const groupLeftAbs = absGroupX;
                        // VISUAL TRIM: Right handle stays within visible box
                        // Minimum: must maintain minimum clip width from left edge
                        const minAbsX = groupLeftAbs + minPixels - HANDLE_W; // account for handle width
                        
                        // Maximum: can't extend beyond available source media
                        const mediaDuration = media?.duration ?? (clip.trimEnd - clip.trimStart);
                        const maxPossibleTrimEnd = mediaDuration; // can't go past media end
                        const maxWidth = (maxPossibleTrimEnd - clip.trimStart) * pixelsPerSecond;
                        const maxAbsX = groupLeftAbs + maxWidth - HANDLE_W;
                        
                        const clampedAbsX = Math.max(minAbsX, Math.min(maxAbsX, pos.x));
                        
                        // DEBUG: Occasionally log constraints (throttled by random to avoid spam)
                        if (DEBUG_TRIM && Math.random() < 0.05) {
                          console.log('[TIMELINE][RIGHT][dragBound] Constraining handle:', {
                            desiredAbsX: pos.x,
                            constraints: { minAbsX, maxAbsX, maxPossibleTrimEnd, HANDLE_W },
                            result: { clampedAbsX },
                            note: 'VISUAL TRIM: handle moves within available source duration',
                          });
                        }
                        
                        return { x: clampedAbsX, y: absGroupY };
                      }}
                      onDragMove={(e) => {
                        const mediaDuration = media?.duration ?? (clip.trimEnd - clip.trimStart);
                        const handleLeftAbsX = e.target.getAbsolutePosition().x;
                        const rightEdgeAbsX = handleLeftAbsX + HANDLE_W;
                        
                        // VISUAL TRIM: Right edge position determines trimEnd
                        const localRightEdgeX = rightEdgeAbsX - absGroupX;
                        const widthFromDrag = localRightEdgeX;
                        const durationFromDrag = widthFromDrag / pixelsPerSecond;
                        
                        const proposedTrimEnd = clamp(
                          snap(clip.trimStart + durationFromDrag),
                          clip.trimStart + minStep,
                          mediaDuration
                        );
                        
                        // EndTime is based on trimmed duration
                        const proposedEndTime = clip.startTime + (proposedTrimEnd - clip.trimStart);
                        
                        setActiveTrim({
                          clipId: clip.id,
                          side: 'right',
                          proposedEndTime,
                          proposedTrimEnd,
                          absX: rightEdgeAbsX,
                          absY: absGroupY,
                        });
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (e.evt as any).cancelBubble = true;
                      }}
                      onDragEnd={(e) => {
                        const mediaDuration = media?.duration ?? (clip.trimEnd - clip.trimStart);
                        const handleLeftAbsX = e.target.getAbsolutePosition().x;
                        const rightEdgeAbsX = handleLeftAbsX + HANDLE_W;
                        
                        // VISUAL TRIM: Calculate new trimEnd based on handle position
                        const localRightEdgeX = rightEdgeAbsX - absGroupX;
                        const widthFromDrag = localRightEdgeX;
                        const durationFromDrag = widthFromDrag / pixelsPerSecond;
                        
                        let newTrimEnd = clamp(
                          snap(clip.trimStart + durationFromDrag),
                          clip.trimStart + minStep,
                          mediaDuration
                        );
                        
                        if (DEBUG_TRIM) {
                          console.log('[TRIM][RIGHT][END]', {
                            clipId: clip.id,
                            before: {
                              clipBounds: { start: clip.startTime, end: clip.endTime },
                              trimBounds: { trimStart: clip.trimStart, trimEnd: clip.trimEnd },
                            },
                            requested: {
                              clipBounds: { start: clip.startTime, end: 'will be recalculated' },
                              trimBounds: { trimStart: clip.trimStart, trimEnd: newTrimEnd },
                            },
                            calculation: { localRightEdgeX, widthFromDrag, durationFromDrag },
                            handleFinalPos: rightEdgeAbsX,
                            note: 'VISUAL TRIM: startTime stays same, only trimEnd changes',
                          });
                        }
                        rippleTrimEnd(clip.id, newTrimEnd, media?.duration ?? null);
                        setActiveTrim(null);
                        
                        // Delay clearing trim flag to prevent Group's onDragEnd from firing
                        // and incorrectly repositioning the clip
                        setTimeout(() => {
                          isTrimmingRef.current = false;
                        }, 100);
                        setIsDraggingClip(false);
                        setHoverTip({ visible: false, text: '', x: 0, y: 0 });
                        
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (e.evt as any).cancelBubble = true;
                      }}
                    />

                    {/* Trim tooltip while dragging */}
                    {activeTrim && activeTrim.clipId === clip.id ? (
                      <Group>
                        {activeTrim.side === 'left' && typeof activeTrim.proposedTrimStart === 'number' ? (
                          <Text
                            x={Math.max(0, (activeTrim.absX - absGroupX) + 10)}
                            y={-18}
                            text={`Start ${formatTime(activeTrim.proposedStartTime ?? clip.startTime)} (Trim ${(
                              activeTrim.proposedTrimStart ?? clip.trimStart
                            ).toFixed(1)}s)`}
                            fontSize={12}
                            fill="#111827"
                          />
                        ) : null}
                        {activeTrim.side === 'right' && typeof activeTrim.proposedTrimEnd === 'number' ? (
                          <Text
                            x={Math.max(0, (activeTrim.absX - absGroupX) - 80)}
                            y={-18}
                            text={`End ${formatTime(activeTrim.proposedEndTime ?? clip.endTime)} (Trim ${(
                              activeTrim.proposedTrimEnd ?? clip.trimEnd
                            ).toFixed(1)}s)`}
                            fontSize={12}
                            fill="#111827"
                          />
                        ) : null}
                      </Group>
                    ) : null}
                  </Group>
                );
              })}

              {/* Playhead - draggable group with larger handle for easier interaction */}
              {/* Hover tooltip for full filename */}
              {hoverTip.visible ? (
                <Group x={hoverTip.x} y={hoverTip.y}>
                  <Rect
                    x={0}
                    y={0}
                    width={Math.min(Math.max(100, hoverTip.text.length * 7), stageWidth - hoverTip.x - 8)}
                    height={28}
                    fill="#111827"
                    opacity={0.95}
                    cornerRadius={6}
                    shadowColor={'#000'}
                    shadowBlur={8}
                    shadowOpacity={0.25}
                  />
                  <Text
                    x={10}
                    y={8}
                    text={hoverTip.text}
                    fontSize={12}
                    fill="#ffffff"
                  />
                </Group>
              ) : null}

              {/* Playhead - draggable group with larger handle for easier interaction */}
              <Group
                x={playheadX}
                y={0}
                draggable
                dragBoundFunc={(pos) => {
                  // Handle is 16px wide, centered at x=-8, so account for this to prevent clipping
                  // At x=0, left edge would be at -8 (clipped), so minimum is x=8
                  // At x=stageWidth, right edge would be at stageWidth+8 (clipped), so maximum is stageWidth-8
                  const handleHalfWidth = 8;
                  const clampedX = Math.max(handleHalfWidth, Math.min(stageWidth - handleHalfWidth, pos.x));
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
                  stroke="#000000" // black
                  strokeWidth={2}
                  hitStrokeWidth={14}
                />
                {/* Handle at the very top for better hit target */}
                <Rect
                  x={-8}
                  y={0}
                  width={16}
                  height={16}
                  fill="#000000"
                  cornerRadius={4}
                  shadowColor={'#000000'}
                  shadowBlur={4}
                  shadowOpacity={0.4}
                />
              </Group>
            </Layer>
          </Stage>
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
};

export default Timeline;



