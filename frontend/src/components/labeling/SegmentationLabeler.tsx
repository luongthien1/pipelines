/**
 * SegmentationLabeler — polygon / instance segmentation annotation.
 *
 * Features:
 * - Click to add polygon points, double-click or click first point to close
 * - Edit mode: drag individual vertices, drag whole polygon
 * - Delete vertex: right-click on vertex
 * - SVG overlay rendered at image resolution, scaled with zoom/pan
 * - Filled polygon with semi-transparent color + outline
 * - Vertex handles shown when selected
 * - AI auto-label: converts bbox detections to 4-point polygons
 */
import React, { useRef, useState, useEffect } from 'react';
import { Box, Pentagon } from 'lucide-react';
import LabelerShell, { getLabelColor } from './shared/LabelerShell';
import SettingsPanel from './shared/SettingsPanel';
import type { InteractionMode } from './shared/types';
import { useViewport } from './shared/useViewport';
import type { LabelerProps } from './shared/types';

interface Polygon {
  label?: string;
  points: number[][];   // [[x,y], ...]  pixel coords
  confidence?: number;
  closed: boolean;
}

const CLOSE_THRESHOLD = 10; // px in screen space to close polygon

const SegmentationLabeler: React.FC<LabelerProps> = ({
  currentId, imageUrl, annotations: initialAnnotations,
  onSave, onCancel, labels: taskLabels, suggestedLabels = [],
  items, onSelectItem, onLoadMore, datasetTask,
  isEmpty: initialIsEmpty = false, onToggleEmpty,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 });
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isEmpty, setIsEmpty] = useState(initialIsEmpty);

  // Polygons
  const [polygons, setPolygons] = useState<Polygon[]>(() =>
    initialAnnotations
      .filter(a => a.points && a.points.length > 0)
      .map(a => ({ label: a.label, points: a.points!, confidence: a.confidence, closed: true }))
  );
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedVertexIdx, setSelectedVertexIdx] = useState<number | null>(null);

  // Drawing in-progress polygon
  const [drawingPoints, setDrawingPoints] = useState<number[][]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Drag state for editing
  const [dragging, setDragging] = useState<
    | { kind: 'vertex'; polyIdx: number; vertIdx: number; startMouse: number[]; startPt: number[] }
    | { kind: 'poly'; polyIdx: number; startMouse: number[]; startPoints: number[][] }
    | null
  >(null);

  // Interaction
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('draw');

  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Labels
  const [sessionLabels, setSessionLabels] = useState<string[]>([]);
  const [activeLabel, setActiveLabel] = useState('');
  const [newLabelInput, setNewLabelInput] = useState('');

  const { containerRef, zoom, offset, resetView, screenToWorld } = useViewport(imgDims, currentId);

  // Sync on item change
  useEffect(() => {
    setPolygons(
      initialAnnotations
        .filter(a => a.points && a.points.length > 0)
        .map(a => ({ label: a.label, points: a.points!, confidence: a.confidence, closed: true }))
    );
    setIsEmpty(initialIsEmpty);
    setSelectedIdx(null);
    setSelectedVertexIdx(null);
    setDrawingPoints([]);
    setIsImageLoading(true);
  }, [currentId, initialAnnotations]);

  useEffect(() => {
    const combined = Array.from(new Set([...taskLabels, ...suggestedLabels]));
    setSessionLabels(combined);
    if (!activeLabel && combined.length > 0) setActiveLabel(combined[0]);
  }, [taskLabels, suggestedLabels]);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); setIsSpacePressed(true); }
      if (e.key === 'r' || e.key === 'R') resetView();
      if (e.key === 'Escape') {
        // Cancel in-progress polygon
        setDrawingPoints([]);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        if (selectedVertexIdx !== null && selectedIdx !== null) {
          // Delete vertex
          setPolygons(prev => {
            const n = [...prev];
            const pts = n[selectedIdx].points.filter((_, i) => i !== selectedVertexIdx);
            if (pts.length < 3) {
              // Too few points — delete whole polygon
              return n.filter((_, i) => i !== selectedIdx);
            }
            n[selectedIdx] = { ...n[selectedIdx], points: pts };
            return n;
          });
          setSelectedVertexIdx(null);
        } else if (selectedIdx !== null) {
          setPolygons(prev => prev.filter((_, i) => i !== selectedIdx));
          setSelectedIdx(null);
        }
      }
      if (e.key === 'Enter' && drawingPoints.length >= 3) {
        // Close polygon with Enter
        closePolygon();
      }
      if (e.key === 'ArrowRight') {
        const idx = items.findIndex(i => i.id === currentId);
        if (idx < items.length - 1) onSelectItem(items[idx + 1].id);
        else if (onLoadMore) onLoadMore();
      }
      if (e.key === 'ArrowLeft') {
        const idx = items.findIndex(i => i.id === currentId);
        if (idx > 0) onSelectItem(items[idx - 1].id);
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setIsSpacePressed(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [selectedIdx, selectedVertexIdx, drawingPoints, items, currentId]);

  const closePolygon = () => {
    if (drawingPoints.length < 3) return;
    setPolygons(prev => [...prev, { label: activeLabel || 'Unlabeled', points: drawingPoints, closed: true }]);
    setSelectedIdx(polygons.length); // select the new polygon
    setDrawingPoints([]);
  };

  // Screen distance between two world points
  const screenDist = (wx1: number, wy1: number, wx2: number, wy2: number) =>
    Math.hypot((wx1 - wx2) * zoom, (wy1 - wy2) * zoom);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;


    const { x: wx, y: wy } = screenToWorld(sx, sy);

    if (interactionMode === 'edit') {
      // Check vertex hit
      for (let pi = 0; pi < polygons.length; pi++) {
        for (let vi = 0; vi < polygons[pi].points.length; vi++) {
          const [px, py] = polygons[pi].points[vi];
          if (screenDist(wx, wy, px, py) < 8) {
            setSelectedIdx(pi); setSelectedVertexIdx(vi);
            setDragging({ kind: 'vertex', polyIdx: pi, vertIdx: vi, startMouse: [wx, wy], startPt: [px, py] });
            return;
          }
        }
      }
      // Check polygon body hit
      for (let pi = 0; pi < polygons.length; pi++) {
        if (pointInPolygon(wx, wy, polygons[pi].points)) {
          setSelectedIdx(pi); setSelectedVertexIdx(null);
          setDragging({ kind: 'poly', polyIdx: pi, startMouse: [wx, wy], startPoints: polygons[pi].points.map(p => [...p]) });
          return;
        }
      }
      setSelectedIdx(null); setSelectedVertexIdx(null);
      return;
    }

    if (interactionMode === 'draw') {
      if (e.detail === 2) {
        // Double-click: close polygon
        closePolygon();
        return;
      }
      // Check if clicking near first point to close
      if (drawingPoints.length >= 3) {
        const [fx, fy] = drawingPoints[0];
        if (screenDist(wx, wy, fx, fy) < CLOSE_THRESHOLD) {
          closePolygon();
          return;
        }
      }
      setDrawingPoints(prev => [...prev, [wx, wy]]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const { x: wx, y: wy } = screenToWorld(sx, sy);
    setMousePos({ x: wx, y: wy });

    if (dragging) {
      const dx = wx - dragging.startMouse[0];
      const dy = wy - dragging.startMouse[1];
      if (dragging.kind === 'vertex') {
        setPolygons(prev => {
          const n = [...prev];
          const pts = n[dragging.polyIdx].points.map((p, i) =>
            i === dragging.vertIdx ? [dragging.startPt[0] + dx, dragging.startPt[1] + dy] : p
          );
          n[dragging.polyIdx] = { ...n[dragging.polyIdx], points: pts };
          return n;
        });
      } else {
        setPolygons(prev => {
          const n = [...prev];
          n[dragging.polyIdx] = {
            ...n[dragging.polyIdx],
            points: dragging.startPoints.map(p => [p[0] + dx, p[1] + dy]),
          };
          return n;
        });
      }
    }
  };

  const handleMouseUp = () => {

    setDragging(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const { x: wx, y: wy } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    // Right-click on vertex → delete it
    for (let pi = 0; pi < polygons.length; pi++) {
      for (let vi = 0; vi < polygons[pi].points.length; vi++) {
        const [px, py] = polygons[pi].points[vi];
        if (screenDist(wx, wy, px, py) < 8) {
          setPolygons(prev => {
            const n = [...prev];
            const pts = n[pi].points.filter((_, i) => i !== vi);
            if (pts.length < 3) return n.filter((_, i) => i !== pi);
            n[pi] = { ...n[pi], points: pts };
            return n;
          });
          return;
        }
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true); setSaveSuccess(false);
    try {
      await onSave(polygons.map(p => ({ label: p.label, points: p.points, confidence: p.confidence })));
      setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000);
    } finally { setIsSaving(false); }
  };

  const handleToggleEmpty = async () => {
    const nv = !isEmpty; setIsEmpty(nv);
    if (onToggleEmpty) await onToggleEmpty(nv);
  };

  const handleAutoLabel = (detections: any[]) => {
    // Convert bbox detections to 4-point polygons
    const newPolys: Polygon[] = detections.map(d => {
      const [x, y, w, h] = d.bbox || [0, 0, 0, 0];
      return {
        label: d.label,
        points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
        confidence: d.confidence,
        closed: true,
      };
    });
    setPolygons(prev => [...prev, ...newPolys]);
  };

  const getCursorClass = () => {
    if (isSpacePressed || interactionMode === 'nav') return 'cursor-grab';
    if (dragging) return dragging.kind === 'vertex' ? 'cursor-move' : 'cursor-move';
    if (interactionMode === 'draw') return 'cursor-crosshair';
    return 'cursor-pointer';
  };

  // SVG polygon path string
  const toSvgPoints = (pts: number[][]) => pts.map(p => `${p[0]},${p[1]}`).join(' ');

  const canvasContent = (
    <div
      ref={containerRef}
      className={`relative h-full w-full select-none overflow-hidden ${getCursorClass()}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      {isImageLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900 z-50 animate-pulse">
          <Box className="w-12 h-12 text-white/10 mb-4 animate-bounce" />
          <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Loading...</span>
        </div>
      )}

      {/* Image + SVG overlay in the same transform layer */}
      <div
        className="absolute will-change-transform"
        style={{
          left: 0, top: 0,
          width: imgDims.w ? `${imgDims.w}px` : 'auto',
          height: imgDims.h ? `${imgDims.h}px` : 'auto',
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Segmentation"
          className="block pointer-events-none"
          style={{ width: imgDims.w ? `${imgDims.w}px` : 'auto', height: imgDims.h ? `${imgDims.h}px` : 'auto', maxWidth: 'none', maxHeight: 'none' }}
          onLoad={() => {
            setIsImageLoading(false);
            if (imgRef.current) setImgDims({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
          }}
        />

        {/* SVG overlay — same size as image */}
        {imgDims.w > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width={imgDims.w}
            height={imgDims.h}
            style={{ overflow: 'visible' }}
          >
            {/* Completed polygons */}
            {polygons.map((poly, pi) => {
              const color = getLabelColor(poly.label);
              const isSelected = selectedIdx === pi;
              const ptsStr = poly.points.map(p => `${p[0]},${p[1]}`).filter(s => !s.includes('NaN')).join(' ');
              if (!ptsStr) return null;

              return (
                <g key={pi} style={{ pointerEvents: 'auto' }}>
                  <polygon
                    points={ptsStr}
                    fill={`${color}33`}
                    stroke={isSelected ? color : `${color}99`}
                    strokeWidth={(isSelected ? 3 : 2) / zoom}
                    strokeLinejoin="round"
                    onClick={(e) => { e.stopPropagation(); setSelectedIdx(pi); setSelectedVertexIdx(null); setInteractionMode('edit'); }}
                    style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                    className={`hover:fill-[${color}55] transition-colors`}
                  />
                  {/* Label */}
                  {poly.points.length > 0 && (
                    <text
                      x={poly.points[0][0]}
                      y={poly.points[0][1] - 8 / zoom}
                      fill={color}
                      fontSize={14 / zoom}
                      fontWeight="900"
                      style={{ 
                        userSelect: 'none', 
                        opacity: isSelected ? 1 : 0.6,
                        paintOrder: 'stroke',
                        stroke: '#000',
                        strokeWidth: 3 / zoom,
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                      }}
                    >
                      {poly.label}
                    </text>
                  )}
                  {/* Vertex handles when selected */}
                  {isSelected && poly.points.map((pt, vi) => (
                    <circle
                      key={vi}
                      cx={pt[0]} cy={pt[1]}
                      r={7 / zoom}
                      fill={selectedVertexIdx === vi ? '#fff' : color}
                      stroke="#fff"
                      strokeWidth={2 / zoom}
                      style={{ cursor: 'move', pointerEvents: 'auto' }}
                      onMouseDown={(e) => { e.stopPropagation(); setSelectedVertexIdx(vi); }}
                      className="hover:scale-125 transition-transform"
                    />
                  ))}
                </g>
              );
            })}

            {/* In-progress polygon */}
            {drawingPoints.length > 0 && (
              <g style={{ pointerEvents: 'none' }}>
                {/* Filled preview */}
                {drawingPoints.length >= 3 && (
                  <polygon
                    points={toSvgPoints(drawingPoints)}
                    fill={`${getLabelColor(activeLabel)}22`}
                    stroke={getLabelColor(activeLabel)}
                    strokeWidth={2 / zoom}
                    strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                  />
                )}
                {/* Lines */}
                {drawingPoints.map((pt, i) => {
                  if (i === 0) return null;
                  const prev = drawingPoints[i - 1];
                  return <line key={i} x1={prev[0]} y1={prev[1]} x2={pt[0]} y2={pt[1]} stroke={getLabelColor(activeLabel)} strokeWidth={2 / zoom} />;
                })}
                {/* Line to cursor */}
                {mousePos && drawingPoints.length > 0 && (
                  <line
                    x1={drawingPoints[drawingPoints.length - 1][0]}
                    y1={drawingPoints[drawingPoints.length - 1][1]}
                    x2={mousePos.x} y2={mousePos.y}
                    stroke={getLabelColor(activeLabel)}
                    strokeWidth={2 / zoom}
                    strokeDasharray={`${4 / zoom} ${4 / zoom}`}
                    opacity={0.8}
                  />
                )}
                {/* Vertices */}
                {drawingPoints.map((pt, i) => {
                  const isFirst = i === 0;
                  const canClose = drawingPoints.length >= 3 && isFirst;
                  return (
                    <circle
                      key={i}
                      cx={pt[0]} cy={pt[1]}
                      r={(isFirst ? 8 : 5) / zoom}
                      fill={canClose ? '#fff' : getLabelColor(activeLabel)}
                      stroke="#fff"
                      strokeWidth={2 / zoom}
                      style={{ pointerEvents: 'auto', cursor: canClose ? 'pointer' : 'default' }}
                      onClick={(e) => { if (canClose) { e.stopPropagation(); closePolygon(); } }}
                    />
                  );
                })}
              </g>
            )}
          </svg>
        )}
      </div>

      {/* Drawing hint */}
      {interactionMode === 'draw' && drawingPoints.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 text-white/60 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full backdrop-blur-xl pointer-events-none">
          {drawingPoints.length >= 3
            ? 'Double-click or click first point to close · Enter to finish'
            : `${drawingPoints.length} point${drawingPoints.length > 1 ? 's' : ''} · need ${3 - drawingPoints.length} more`}
        </div>
      )}
    </div>
  );

  // Extra controls for segmentation: polygon tool hint
  const extraControls = (
    <div className="flex bg-black/60 border border-white/10 p-3 rounded-2xl self-start gap-3 items-center">
      <Pentagon className="w-4 h-4 text-[var(--green)]" />
      <div className="text-[9px] text-white/40 font-bold leading-relaxed">
        <div>Click to add points</div>
        <div>Double-click / Enter to close</div>
        <div>Right-click vertex to delete</div>
      </div>
    </div>
  );

  const settingsPanel = (
    <SettingsPanel
      interactionMode={interactionMode}
      onModeChange={(m) => {
        setInteractionMode(m);
        if (m !== 'draw') setDrawingPoints([]); // cancel in-progress polygon
      }}
      sessionLabels={sessionLabels}
      activeLabel={activeLabel}
      onLabelClick={(label) => {
        setActiveLabel(label);
        if (interactionMode === 'edit' && selectedIdx !== null) {
          setPolygons(prev => { const n = [...prev]; n[selectedIdx] = { ...n[selectedIdx], label }; return n; });
        }
      }}
      newLabelInput={newLabelInput}
      onNewLabelChange={setNewLabelInput}
      onAddLabel={(e) => {
        e.preventDefault();
        if (!newLabelInput.trim()) return;
        if (!sessionLabels.includes(newLabelInput)) setSessionLabels(prev => [...prev, newLabelInput]);
        setActiveLabel(newLabelInput);
        if (interactionMode === 'edit' && selectedIdx !== null) {
          setPolygons(prev => { const n = [...prev]; n[selectedIdx] = { ...n[selectedIdx], label: newLabelInput }; return n; });
        }
        setNewLabelInput('');
      }}
      datasetTask={datasetTask}
      currentItemId={currentId}
      imgDims={imgDims}
      onAutoLabel={handleAutoLabel}
      extraControls={extraControls}
    />
  );

  // Layer preview: small polygon icon with color
  const layerPreview = (poly: Polygon) => (
    <svg width="12" height="12" viewBox="0 0 12 12">
      <polygon points="6,1 11,4 11,8 6,11 1,8 1,4" fill={`${getLabelColor(poly.label)}66`} stroke={getLabelColor(poly.label)} strokeWidth="1.5" />
    </svg>
  );

  return (
    <LabelerShell
      items={items}
      currentId={currentId}
      onSelectItem={onSelectItem}
      canvasContent={canvasContent}
      settingsPanel={settingsPanel}
      layers={polygons.map(p => ({ label: p.label, preview: layerPreview(p) }))}
      selectedIdx={selectedIdx}
      onSelectLayer={(idx) => { setSelectedIdx(idx); setSelectedVertexIdx(null); setInteractionMode('edit'); }}
      onDeleteLayer={(idx) => { setPolygons(prev => prev.filter((_, i) => i !== idx)); setSelectedIdx(null); setSelectedVertexIdx(null); }}
      onResetView={resetView}
      onClear={() => { if (polygons.length > 0 && window.confirm('Clear all annotations?')) { setPolygons([]); setSelectedIdx(null); setDrawingPoints([]); } }}
      onSave={handleSave}
      onCancel={onCancel}
      onToggleEmpty={handleToggleEmpty}
      isEmpty={isEmpty}
      isSaving={isSaving}
      saveSuccess={saveSuccess}
      onLoadMore={onLoadMore}
    />
  );
};

// Ray casting algorithm — point in polygon test
function pointInPolygon(x: number, y: number, pts: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1];
    const xj = pts[j][0], yj = pts[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

export default SegmentationLabeler;
