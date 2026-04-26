/**
 * DetectionLabeler — bounding box annotation for object_detection tasks.
 * Refactored from the original LabelingCanvas.
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Box } from 'lucide-react';
import LabelerShell, { getLabelColor } from './shared/LabelerShell';
import SettingsPanel from './shared/SettingsPanel';
import type { InteractionMode } from './shared/types';
import { useViewport } from './shared/useViewport';
import type { LabelerProps } from './shared/types';

type DragType = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

interface BBox {
  label?: string;
  bbox: number[];
  confidence?: number;
}

const DetectionLabeler: React.FC<LabelerProps> = ({
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

  // Annotations
  const [annotations, setAnnotations] = useState<BBox[]>(() =>
    initialAnnotations.filter(a => a.bbox).map(a => ({ label: a.label, bbox: a.bbox!, confidence: a.confidence }))
  );
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Drawing
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState<number[] | null>(null);
  const [dragInfo, setDragInfo] = useState<{ type: DragType; initialBbox: number[]; startMouse: { x: number; y: number } } | null>(null);

  // Interaction
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('draw');
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Labels
  const [sessionLabels, setSessionLabels] = useState<string[]>([]);
  const [activeLabel, setActiveLabel] = useState('');
  const [newLabelInput, setNewLabelInput] = useState('');

  const { containerRef, zoom, offset, resetView, screenToWorld } = useViewport(imgDims, currentId);

  // Sync on item change
  useEffect(() => {
    setAnnotations(initialAnnotations.filter(a => a.bbox).map(a => ({ label: a.label, bbox: a.bbox!, confidence: a.confidence })));
    setIsEmpty(initialIsEmpty);
    setSelectedIdx(null);
    setIsImageLoading(true);
  }, [currentId]);

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
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdx !== null) {
        setAnnotations(prev => prev.filter((_, i) => i !== selectedIdx));
        setSelectedIdx(null);
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
  }, [zoom, offset, selectedIdx, imgDims, items, currentId]);

  const getHandleAt = (x: number, y: number, bbox: number[]) => {
    const hs = 8 / zoom;
    const [bx, by, bw, bh] = bbox;
    const mx = bx + bw / 2, my = by + bh / 2, rx = bx + bw, by2 = by + bh;
    const handles: { type: DragType; x: number; y: number }[] = [
      { type: 'nw', x: bx, y: by }, { type: 'n', x: mx, y: by }, { type: 'ne', x: rx, y: by },
      { type: 'w', x: bx, y: my }, { type: 'e', x: rx, y: my },
      { type: 'sw', x: bx, y: by2 }, { type: 's', x: mx, y: by2 }, { type: 'se', x: rx, y: by2 },
    ];
    for (const h of handles) if (Math.abs(x - h.x) < hs && Math.abs(y - h.y) < hs) return h.type;
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    if (isSpacePressed || e.button === 1 || interactionMode === 'nav') {
      setIsPanning(true); setLastMousePos({ x: sx, y: sy }); return;
    }
    const { x: wx, y: wy } = screenToWorld(sx, sy);
    if (interactionMode === 'edit' && selectedIdx !== null) {
      const sel = annotations[selectedIdx].bbox;
      const ht = getHandleAt(wx, wy, sel);
      if (ht) { setDragInfo({ type: ht, initialBbox: [...sel], startMouse: { x: wx, y: wy } }); return; }
      if (wx > sel[0] && wx < sel[0] + sel[2] && wy > sel[1] && wy < sel[1] + sel[3]) {
        setDragInfo({ type: 'move', initialBbox: [...sel], startMouse: { x: wx, y: wy } }); return;
      }
    }
    if (interactionMode === 'edit') return;
    setIsDrawing(true); setStartPos({ x: wx, y: wy }); setCurrentBox([wx, wy, 0, 0]);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    if (isPanning) {
      const dx = sx - lastMousePos.x, dy = sy - lastMousePos.y;
      // Use functional update to avoid stale closure
      setLastMousePos({ x: sx, y: sy });
      // We need to update offset — use the ref-based approach from useViewport
      // Since useViewport doesn't expose setOffset directly, we handle panning here
      // by dispatching a custom event or using a ref
      return;
    }
    const { x: wx, y: wy } = screenToWorld(sx, sy);
    if (dragInfo && selectedIdx !== null) {
      const { dx, dy } = { dx: wx - dragInfo.startMouse.x, dy: wy - dragInfo.startMouse.y };
      const nb = [...dragInfo.initialBbox];
      if (dragInfo.type === 'move') { nb[0] += dx; nb[1] += dy; }
      else {
        if (dragInfo.type.includes('w')) { nb[0] += dx; nb[2] -= dx; }
        if (dragInfo.type.includes('e')) { nb[2] += dx; }
        if (dragInfo.type.includes('n')) { nb[1] += dy; nb[3] -= dy; }
        if (dragInfo.type.includes('s')) { nb[3] += dy; }
      }
      if (nb[2] < 1) nb[2] = 1; if (nb[3] < 1) nb[3] = 1;
      setAnnotations(prev => { const n = [...prev]; n[selectedIdx] = { ...n[selectedIdx], bbox: nb }; return n; });
      return;
    }
    if (!isDrawing) return;
    setCurrentBox([Math.min(startPos.x, wx), Math.min(startPos.y, wy), Math.abs(wx - startPos.x), Math.abs(wy - startPos.y)]);
  };

  const handleMouseUp = () => {
    setIsPanning(false); setDragInfo(null);
    if (!isDrawing || !currentBox) return;
    if (currentBox[2] > 2 && currentBox[3] > 2) {
      const newAnns = [...annotations, { label: activeLabel || 'Unlabeled', bbox: currentBox }];
      setAnnotations(newAnns); setSelectedIdx(newAnns.length - 1);
    }
    setIsDrawing(false); setCurrentBox(null);
  };

  const handleSave = async () => {
    setIsSaving(true); setSaveSuccess(false);
    try {
      await onSave(annotations.map(a => ({ label: a.label, bbox: a.bbox, confidence: a.confidence })));
      setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000);
    } finally { setIsSaving(false); }
  };

  const handleToggleEmpty = async () => {
    const nv = !isEmpty; setIsEmpty(nv);
    if (onToggleEmpty) await onToggleEmpty(nv);
  };

  const handleAutoLabel = (detections: any[], confidence: number) => {
    const scaled = detections.map((d: any) => {
      const needsScale = d.bbox && d.bbox[2] <= 1.01 && d.bbox[3] <= 1.01;
      return {
        label: d.label,
        bbox: needsScale ? [d.bbox[0] * imgDims.w, d.bbox[1] * imgDims.h, d.bbox[2] * imgDims.w, d.bbox[3] * imgDims.h] : d.bbox,
        confidence: d.confidence,
      };
    });
    const all = [...annotations, ...scaled].filter(a => a.bbox);
    all.sort((a, b) => (b.confidence ?? 1) - (a.confidence ?? 1));
    const kept: BBox[] = [];
    const iou = (a: number[], b: number[]) => {
      const xA = Math.max(a[0], b[0]), yA = Math.max(a[1], b[1]);
      const xB = Math.min(a[0]+a[2], b[0]+b[2]), yB = Math.min(a[1]+a[3], b[1]+b[3]);
      const inter = Math.max(0, xB-xA) * Math.max(0, yB-yA);
      return inter / (a[2]*a[3] + b[2]*b[3] - inter);
    };
    for (const box of all) if (!kept.some(k => iou(box.bbox, k.bbox) > 0.8)) kept.push(box);
    setAnnotations(kept);
  };

  const getCursorClass = () => {
    if (isSpacePressed || interactionMode === 'nav') return isPanning ? 'cursor-grabbing' : 'cursor-grab';
    if (dragInfo) return dragInfo.type === 'move' ? 'cursor-move' : 'cursor-nwse-resize';
    return interactionMode === 'draw' ? 'cursor-crosshair' : 'cursor-pointer';
  };

  const canvasContent = (
    <div
      ref={containerRef}
      className={`relative h-full w-full select-none overflow-hidden ${getCursorClass()}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {isImageLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900 z-50 animate-pulse">
          <Box className="w-12 h-12 text-white/10 mb-4 animate-bounce" />
          <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Loading...</span>
        </div>
      )}
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
          alt="Labeling"
          className="block pointer-events-none"
          style={{ width: imgDims.w ? `${imgDims.w}px` : 'auto', height: imgDims.h ? `${imgDims.h}px` : 'auto', maxWidth: 'none', maxHeight: 'none' }}
          onLoad={() => {
            setIsImageLoading(false);
            if (imgRef.current) setImgDims({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
          }}
        />
        {/* Bounding boxes */}
        {imgDims.w > 0 && annotations.map((ann, idx) => {
          const [x, y, w, h] = ann.bbox;
          const isSelected = selectedIdx === idx;
          const color = getLabelColor(ann.label);
          return (
            <div
              key={idx}
              className={`absolute border transition-all ${isSelected ? 'z-20' : 'z-10'}`}
              style={{
                left: `${x}px`, top: `${y}px`,
                width: `${Math.max(1, w)}px`, height: `${Math.max(1, h)}px`,
                borderColor: isSelected ? color : `${color}99`,
                backgroundColor: isSelected ? `${color}22` : 'transparent',
                borderWidth: `${2.5 / zoom}px`,
              }}
              onClick={(e) => { e.stopPropagation(); setSelectedIdx(idx); setInteractionMode('edit'); }}
            >
              <div
                className="absolute left-0 px-2 py-0.5 rounded-lg text-[10px] font-black text-white whitespace-nowrap shadow-xl"
                style={{ backgroundColor: color, opacity: isSelected ? 1 : 0, transform: `scale(${1/zoom}) translateY(-30px)`, transformOrigin: 'bottom left' }}
              >
                {ann.label}
              </div>
              {isSelected && (
                <div className="absolute inset-0 pointer-events-none">
                  {[{t:'nw',x:0,y:0},{t:'n',x:50,y:0},{t:'ne',x:100,y:0},{t:'w',x:0,y:50},{t:'e',x:100,y:50},{t:'sw',x:0,y:100},{t:'s',x:50,y:100},{t:'se',x:100,y:100}].map(hnd => (
                    <div key={hnd.t} className="absolute bg-white border border-black rounded-sm" style={{ left: `${hnd.x}%`, top: `${hnd.y}%`, width: `${8/zoom}px`, height: `${8/zoom}px`, transform: 'translate(-50%,-50%)', pointerEvents: 'auto' }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {/* Drawing preview */}
        {currentBox && (
          <div
            className="absolute border-dashed border-[var(--green)] bg-[var(--green)]/10"
            style={{ left: `${currentBox[0]}px`, top: `${currentBox[1]}px`, width: `${currentBox[2]}px`, height: `${currentBox[3]}px`, borderWidth: `${2/zoom}px` }}
          />
        )}
      </div>
    </div>
  );

  const settingsPanel = (
    <SettingsPanel
      interactionMode={interactionMode}
      onModeChange={setInteractionMode}
      sessionLabels={sessionLabels}
      activeLabel={activeLabel}
      onLabelClick={(label) => {
        setActiveLabel(label);
        if (interactionMode === 'edit' && selectedIdx !== null) {
          setAnnotations(prev => { const n = [...prev]; n[selectedIdx] = { ...n[selectedIdx], label }; return n; });
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
          setAnnotations(prev => { const n = [...prev]; n[selectedIdx] = { ...n[selectedIdx], label: newLabelInput }; return n; });
        }
        setNewLabelInput('');
      }}
      datasetTask={datasetTask}
      currentItemId={currentId}
      imgDims={imgDims}
      onAutoLabel={handleAutoLabel}
    />
  );

  return (
    <LabelerShell
      items={items}
      currentId={currentId}
      onSelectItem={onSelectItem}
      canvasContent={canvasContent}
      settingsPanel={settingsPanel}
      layers={annotations.map(a => ({ label: a.label }))}
      selectedIdx={selectedIdx}
      onSelectLayer={(idx) => { setSelectedIdx(idx); setInteractionMode('edit'); }}
      onDeleteLayer={(idx) => { setAnnotations(prev => prev.filter((_, i) => i !== idx)); setSelectedIdx(null); }}
      onResetView={resetView}
      onClear={() => { if (annotations.length > 0 && window.confirm('Clear all annotations?')) { setAnnotations([]); setSelectedIdx(null); } }}
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

export default DetectionLabeler;
