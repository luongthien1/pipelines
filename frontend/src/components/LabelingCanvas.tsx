/**
 * LabelingCanvas — Direct TypeScript port of the original "old app" LabelingCanvas.tsx
 * Preserves 100% identical UI/UX: left asset strip, canvas, floating settings, right toolbar, layers panel.
 */
import React, { useRef, useState, useEffect } from 'react';
import {
  Trash2, Check, X, Zap, Box, Maximize,
  PlusCircle, Hand, ChevronRight, ChevronLeft,
  Settings, MousePointer2, Tag, Circle, CheckCircle2,
} from 'lucide-react';
import { BACKEND_URL } from '../hooks/useApi';

// ── Types ───────────────────────────────────────────────────────────────────

interface Annotation {
  label?: string;
  bbox?: number[];       // [x, y, w, h]
  polygon?: number[][];  // [[x,y], ...] — segmentation
  confidence?: number;
}

type DragType = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

export interface LabelingCanvasProps {
  currentId: number;
  imageUrl: string;
  annotations: Annotation[];
  onSave: (annotations: Annotation[]) => Promise<void>;
  onCancel: () => void;
  labels: string[];
  suggestedLabels?: string[];
  items: any[];
  onSelectItem: (id: number) => void;
  onLoadMore?: () => void;
  datasetTask?: string;
  isEmpty?: boolean;
  onToggleEmpty?: (isEmpty: boolean) => Promise<void>;
}

// ── Color helper ─────────────────────────────────────────────────────────────

const LABEL_COLORS = [
  '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1',
];

function getLabelColor(label?: string) {
  if (!label) return LABEL_COLORS[0];
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + ((hash << 5) - hash);
  return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length];
}

// ── Component ────────────────────────────────────────────────────────────────

const LabelingCanvas: React.FC<LabelingCanvasProps> = ({
  currentId,
  imageUrl,
  annotations: initialAnnotations,
  onSave,
  onCancel,
  labels: taskLabels,
  suggestedLabels = [],
  items,
  onSelectItem,
  onLoadMore,
  isEmpty: initialIsEmpty = false,
  onToggleEmpty,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [isEmpty, setIsEmpty] = useState(initialIsEmpty);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState<number[] | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 });
  const [initialSized, setInitialSized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [sessionLabels, setSessionLabels] = useState<string[]>([]);
  const [newLabelInput, setNewLabelInput] = useState('');
  const [activeLabel, setActiveLabel] = useState('');

  const [interactionMode, setInteractionMode] = useState<'draw' | 'edit' | 'nav'>('draw');
  const [isRightSidebarExpanded, setIsRightSidebarExpanded] = useState(true);
  const [dragInfo, setDragInfo] = useState<{
    type: DragType;
    initialBbox: number[];
    startMouse: { x: number; y: number };
  } | null>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [visibleItems, setVisibleItems] = useState<any[]>([]);

  // keep refs in sync
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { offsetRef.current = offset; }, [offset]);

  // sync labels
  useEffect(() => {
    const combined = Array.from(new Set([...taskLabels, ...suggestedLabels]));
    setSessionLabels(combined);
    if (!activeLabel && combined.length > 0) setActiveLabel(combined[0]);
  }, [taskLabels, suggestedLabels]);

  // reset when item changes
  useEffect(() => {
    setAnnotations(initialAnnotations);
    setIsEmpty(initialIsEmpty);
    setSelectedIdx(null);
    setInitialSized(false);
    setIsImageLoading(true);
  }, [currentId, initialAnnotations, initialIsEmpty]);

  // visible item slice
  useEffect(() => {
    const currentIndex = items.findIndex(i => i.id === currentId);
    if (currentIndex === -1) { setVisibleItems(items.slice(0, 20)); return; }
    const start = Math.max(0, currentIndex - 10);
    const end = Math.min(items.length, start + 20);
    setVisibleItems(items.slice(start, end));
    if (currentIndex > items.length - 2 && onLoadMore) onLoadMore();
  }, [items, currentId, onLoadMore]);

  // fit zoom helper
  const calculateFitZoom = (w: number, h: number) => {
    if (!containerRef.current || w === 0 || h === 0) return 1;
    const rect = containerRef.current.getBoundingClientRect();
    const pad = 60;
    return Math.min((rect.width - pad) / w, (rect.height - pad) / h);
  };

  // auto-fit when image loads
  useEffect(() => {
    if (!containerRef.current || imgDims.w === 0 || initialSized) return;
    const applyFit = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 100 && rect.height > 100) {
        const fz = calculateFitZoom(imgDims.w, imgDims.h);
        setZoom(fz);
        setOffset({ x: (rect.width - imgDims.w * fz) / 2, y: (rect.height - imgDims.h * fz) / 2 });
        setInitialSized(true);
      }
    };
    applyFit();
    const id = setTimeout(applyFit, 300);
    return () => clearTimeout(id);
  }, [imgDims.w, imgDims.h, currentId, initialSized]);

  // keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); setIsSpacePressed(true); }
      if (e.key === 'r' || e.key === 'R') resetView();
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdx !== null) deleteAnnotation(selectedIdx);
      if (e.key === 'ArrowRight' && !e.shiftKey) {
        const idx = items.findIndex(i => i.id === currentId);
        if (idx < items.length - 1) onSelectItem(items[idx + 1].id);
        else if (onLoadMore) onLoadMore();
      }
      if (e.key === 'ArrowLeft' && !e.shiftKey) {
        const idx = items.findIndex(i => i.id === currentId);
        if (idx > 0) onSelectItem(items[idx - 1].id);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [zoom, offset, selectedIdx, imgDims, items, currentId]);

  // native wheel zoom (passive:false required)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation();
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const pz = zoomRef.current, po = offsetRef.current;
      const nz = Math.max(0.01, Math.min(pz * factor, 50));
      const no = { x: mx - (mx - po.x) * (nz / pz), y: my - (my - po.y) * (nz / pz) };
      zoomRef.current = nz; offsetRef.current = no;
      setZoom(nz); setOffset(no);
    };
    container.addEventListener('wheel', handler, { passive: false });
    return () => container.removeEventListener('wheel', handler);
  }, []);

  const resetView = () => {
    if (imgDims.w > 0 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const fz = calculateFitZoom(imgDims.w, imgDims.h);
      setZoom(fz);
      setOffset({ x: (rect.width - imgDims.w * fz) / 2, y: (rect.height - imgDims.h * fz) / 2 });
    }
  };

  // resize handle detection
  const getHandleAt = (x: number, y: number, bbox: number[]): DragType | null => {
    const hs = 8 / zoom;
    const [bx, by, bw, bh] = bbox;
    const mx = bx + bw / 2, my = by + bh / 2, r = bx + bw, b = by + bh;
    const handles: { type: DragType; x: number; y: number }[] = [
      { type: 'nw', x: bx, y: by }, { type: 'n', x: mx, y: by }, { type: 'ne', x: r, y: by },
      { type: 'w',  x: bx, y: my }, { type: 'e', x: r,  y: my },
      { type: 'sw', x: bx, y: b  }, { type: 's', x: mx, y: b  }, { type: 'se', x: r, y: b },
    ];
    for (const h of handles) if (Math.abs(x - h.x) < hs && Math.abs(y - h.y) < hs) return h.type;
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (isSpacePressed || e.button === 1 || interactionMode === 'nav') {
      setIsPanning(true); setLastMousePos({ x, y }); return;
    }
    const wx = (x - offset.x) / zoom, wy = (y - offset.y) / zoom;
    if (interactionMode === 'edit' && selectedIdx !== null) {
      const selBox = annotations[selectedIdx].bbox!;
      const ht = getHandleAt(wx, wy, selBox);
      if (ht) { setDragInfo({ type: ht, initialBbox: [...selBox], startMouse: { x: wx, y: wy } }); return; }
      if (wx > selBox[0] && wx < selBox[0] + selBox[2] && wy > selBox[1] && wy < selBox[1] + selBox[3]) {
        setDragInfo({ type: 'move', initialBbox: [...selBox], startMouse: { x: wx, y: wy } }); return;
      }
    }
    if (interactionMode === 'edit') return;
    setIsDrawing(true); setStartPos({ x: wx, y: wy }); setCurrentBox([wx, wy, 0, 0]);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (isPanning) {
      setOffset(prev => ({ x: prev.x + (x - lastMousePos.x), y: prev.y + (y - lastMousePos.y) }));
      setLastMousePos({ x, y }); return;
    }
    const wx = (x - offset.x) / zoom, wy = (y - offset.y) / zoom;
    if (dragInfo && selectedIdx !== null) {
      const dx = wx - dragInfo.startMouse.x, dy = wy - dragInfo.startMouse.y;
      const nb = [...dragInfo.initialBbox];
      if (dragInfo.type === 'move') { nb[0] += dx; nb[1] += dy; }
      else {
        if (dragInfo.type.includes('w')) { nb[0] += dx; nb[2] -= dx; }
        if (dragInfo.type.includes('e')) { nb[2] += dx; }
        if (dragInfo.type.includes('n')) { nb[1] += dy; nb[3] -= dy; }
        if (dragInfo.type.includes('s')) { nb[3] += dy; }
      }
      if (nb[2] < 1) nb[2] = 1; if (nb[3] < 1) nb[3] = 1;
      const na = [...annotations]; na[selectedIdx] = { ...na[selectedIdx], bbox: nb };
      setAnnotations(na); return;
    }
    if (!isDrawing) return;
    setCurrentBox([Math.min(startPos.x, wx), Math.min(startPos.y, wy), Math.abs(wx - startPos.x), Math.abs(wy - startPos.y)]);
  };

  const handleMouseUp = () => {
    setIsPanning(false); setDragInfo(null);
    if (!isDrawing || !currentBox) return;
    if (currentBox[2] > 2 && currentBox[3] > 2) {
      const na = [...annotations, { label: activeLabel || 'Unlabeled', bbox: currentBox }];
      setAnnotations(na); setSelectedIdx(na.length - 1);
    }
    setIsDrawing(false); setCurrentBox(null);
  };

  const deleteAnnotation = (idx: number) => {
    setAnnotations(annotations.filter((_, i) => i !== idx)); setSelectedIdx(null);
  };

  const handleAddCustomLabel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelInput.trim()) return;
    if (!sessionLabels.includes(newLabelInput)) setSessionLabels([...sessionLabels, newLabelInput]);
    setActiveLabel(newLabelInput);
    if (interactionMode === 'edit' && selectedIdx !== null) {
      const n = [...annotations]; n[selectedIdx] = { ...n[selectedIdx], label: newLabelInput };
      setAnnotations(n);
    }
    setNewLabelInput('');
  };

  const handleSave = async () => {
    setIsSaving(true); setSaveSuccess(false);
    try { await onSave(annotations); setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); }
    finally { setIsSaving(false); }
  };

  const handleToggleEmpty = async () => {
    const nv = !isEmpty; setIsEmpty(nv);
    if (onToggleEmpty) await onToggleEmpty(nv);
  };

  const getCursorClass = () => {
    if (isSpacePressed || interactionMode === 'nav') return isPanning ? 'cursor-grabbing' : 'cursor-grab';
    if (dragInfo) {
      if (dragInfo.type === 'move') return 'cursor-move';
      if (['n', 's'].includes(dragInfo.type)) return 'cursor-ns-resize';
      if (['e', 'w'].includes(dragInfo.type)) return 'cursor-ew-resize';
      return (dragInfo.type.includes('nw') || dragInfo.type.includes('se')) ? 'cursor-nwse-resize' : 'cursor-nesw-resize';
    }
    return interactionMode === 'draw' ? 'cursor-crosshair' : interactionMode === 'edit' ? 'cursor-pointer' : 'cursor-default';
  };

  const currentIdx = items.findIndex(i => i.id === currentId);

  // ── Toolbar inner components (identical class structure to old app) ─────────
  const Btn = ({
    onClick, disabled = false, colorClass, children,
  }: { onClick: () => void; disabled?: boolean; colorClass: string; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group/btn flex items-center justify-end h-11 rounded-2xl bg-black/50 border border-white/10 backdrop-blur-xl transition-all duration-200 overflow-hidden disabled:opacity-20 disabled:cursor-not-allowed ${colorClass}`}
    >
      {children}
    </button>
  );

  const BtnIcon = ({ children }: { children: React.ReactNode }) => (
    <span className="w-11 h-11 flex items-center justify-center shrink-0">{children}</span>
  );

  const BtnLabel = ({ text, forceShow = false }: { text: string; forceShow?: boolean }) => (
    <span className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap pr-4 transition-all duration-200 overflow-hidden ${forceShow ? 'max-w-[120px] opacity-100' : 'max-w-0 opacity-0 group-hover/btn:max-w-[120px] group-hover/btn:opacity-100'}`}>
      {text}
    </span>
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full bg-[#0a0a0a] overflow-hidden relative group/studio shrink-0">

      {/* ── Left: Asset Strip ─────────────────────────────────────────────── */}
      <div className="w-12 hover:w-64 bg-black/80 backdrop-blur-3xl border-r border-white/5 flex flex-col shrink-0 transition-all duration-500 z-30 group/sidebar">
        <div className="p-4 border-b border-white/5 opacity-0 group-hover/sidebar:opacity-100 transition-all duration-300">
          <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] whitespace-nowrap">
            Source Assets ({items.length})
          </h4>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar">
          {visibleItems.map((item: any) => (
            <div
              key={item.id}
              onClick={() => onSelectItem(item.id)}
              className={`group relative aspect-square rounded-2xl overflow-hidden cursor-pointer border-2 transition-all duration-300 ${
                currentId === item.id
                  ? 'border-[var(--green)] ring-8 ring-[var(--green)]/10 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                  : 'border-transparent grayscale hover:grayscale-0 hover:border-white/20'
              }`}
            >
              <img
                src={`${BACKEND_URL}${item.thumbnail_url || item.url}`}
                alt={item.file_name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              {item.annotations && item.annotations.length > 0 && (
                <div className="absolute top-1.5 right-1.5 bg-[var(--green)] text-white p-1 rounded-md shadow-[0_2px_10px_rgba(34,197,94,0.3)] z-10" title="Labeled">
                  <Tag className="w-3 h-3" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Center: Canvas ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-black relative p-6 h-full">
        <div className={`relative h-full w-full bg-[#0c0c0c] rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl ${getCursorClass()} transition-colors duration-500`}>

          {/* Drawing area */}
          <div
            ref={containerRef}
            className="relative h-full w-full select-none overflow-hidden"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={e => e.preventDefault()}
          >
            {/* Loading state */}
            {isImageLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900 z-50 animate-pulse">
                <Box className="w-12 h-12 text-white/10 mb-4 animate-bounce" />
                <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Optimizing Assets...</span>
              </div>
            )}

            {/* Transform layer */}
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
                className="block pointer-events-none shadow-[0_0_100px_rgba(0,0,0,0.5)]"
                style={{ width: imgDims.w ? `${imgDims.w}px` : 'auto', height: imgDims.h ? `${imgDims.h}px` : 'auto', maxWidth: 'none', maxHeight: 'none' }}
                onLoad={() => {
                  setIsImageLoading(false);
                  if (imgRef.current) setImgDims({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
                }}
              />

              {/* Bounding boxes */}
              {imgDims.w > 0 && annotations.map((ann, idx) => {
                const [x, y, w, h] = ann.bbox || [0, 0, 0, 0];
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
                    onClick={e => { e.stopPropagation(); setSelectedIdx(idx); setInteractionMode('edit'); }}
                  >
                    <div
                      className="absolute left-0 px-2 py-0.5 rounded-lg text-[10px] font-black text-white whitespace-nowrap shadow-xl"
                      style={{ backgroundColor: color, opacity: isSelected ? 1 : 0, transform: `scale(${1 / zoom}) translateY(-30px)`, transformOrigin: 'bottom left' }}
                    >
                      {ann.label}
                    </div>
                    {isSelected && (
                      <div className="absolute inset-0 pointer-events-none">
                        {[{t:'nw',x:0,y:0},{t:'n',x:50,y:0},{t:'ne',x:100,y:0},{t:'w',x:0,y:50},{t:'e',x:100,y:50},{t:'sw',x:0,y:100},{t:'s',x:50,y:100},{t:'se',x:100,y:100}].map(hnd => (
                          <div
                            key={hnd.t}
                            className="absolute bg-white border border-black rounded-sm"
                            style={{ left: `${hnd.x}%`, top: `${hnd.y}%`, width: `${8/zoom}px`, height: `${8/zoom}px`, transform: 'translate(-50%,-50%)', pointerEvents: 'auto' }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Drawing box preview */}
              {currentBox && (
                <div
                  className="absolute border-dashed border-[var(--green)] bg-[var(--green)]/10"
                  style={{ left: `${currentBox[0]}px`, top: `${currentBox[1]}px`, width: `${currentBox[2]}px`, height: `${currentBox[3]}px`, borderWidth: `${2/zoom}px` }}
                />
              )}
            </div>
          </div>

          {/* ── Top-left: Settings Dashboard ─────────────────────────────── */}
          <div className="absolute top-8 left-8 z-40 flex flex-col items-start gap-3 group/dashboard">
            {/* Collapsed pill */}
            <div className="bg-black/90 backdrop-blur-2xl border border-white/10 p-3.5 rounded-2xl flex items-center gap-3 text-white/80 shadow-2xl group-hover/dashboard:hidden">
              <Settings className="w-5 h-5 text-[var(--green)]" />
              <span className="text-[10px] font-black uppercase tracking-widest bg-white/10 px-2 py-1 rounded-md">Settings</span>
            </div>

            {/* Expanded panel */}
            <div className="hidden group-hover/dashboard:flex flex-col gap-4 origin-top-left transition-all">
              {/* Mode switcher */}
              <div className="flex bg-black/60 border border-white/10 p-1.5 rounded-3xl self-start">
                {([{id:'draw',icon:PlusCircle,label:'Draw'},{id:'edit',icon:MousePointer2,label:'Edit'},{id:'nav',icon:Hand,label:'Move'}] as const).map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setInteractionMode(mode.id)}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all duration-300 ${interactionMode === mode.id ? 'bg-white text-black shadow-lg scale-105' : 'text-white/40 hover:text-white/70'}`}
                  >
                    <mode.icon className="w-4 h-4" />
                    <span className={interactionMode === mode.id ? 'block' : 'hidden'}>{mode.label}</span>
                  </button>
                ))}
              </div>

              {/* Settings card */}
              <div className="bg-black/80 border border-white/10 p-6 rounded-[2.5rem] w-80 space-y-6 shadow-2xl">
                {/* Taxonomy */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest">Taxonomy</h4>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto no-scrollbar">
                    {sessionLabels.map(label => (
                      <button
                        key={label}
                        onClick={() => {
                          setActiveLabel(label);
                          if (interactionMode === 'edit' && selectedIdx !== null) {
                            const n = [...annotations]; n[selectedIdx] = { ...n[selectedIdx], label };
                            setAnnotations(n);
                          }
                        }}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${activeLabel === label ? 'bg-white text-black ring-4 ring-white/10' : 'bg-white/5 text-white/50 border border-white/10 hover:border-white/30'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <form onSubmit={handleAddCustomLabel} className="flex gap-2">
                    <input
                      type="text"
                      value={newLabelInput}
                      onChange={e => setNewLabelInput(e.target.value)}
                      placeholder="New Label..."
                      className="flex-1 px-4 py-2 text-[10px] font-bold rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-white/30"
                    />
                    <button type="submit" className="px-3 bg-white text-black rounded-xl hover:bg-white/90 transition-all focus:ring-2 ring-white/20">
                      <Check className="w-4 h-4" />
                    </button>
                  </form>
                </div>

                {/* AI section placeholder */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-3xl">
                  <div className="flex items-center gap-2 text-[var(--green)]">
                    <Zap className="w-4 h-4 fill-current" />
                    <h4 className="text-[9px] font-black uppercase">AI Auto-Pilot</h4>
                  </div>
                  <p className="text-[9px] text-white/30 mt-2">Connect a model version to auto-label this image.</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Floating Vertical Toolbar ─────────────────────────── */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-40">
            <Btn onClick={() => { if (currentIdx > 0) onSelectItem(items[currentIdx - 1].id); }} disabled={currentIdx <= 0} colorClass="text-white/50 hover:text-white">
              <BtnLabel text="Previous" /><BtnIcon><ChevronLeft className="w-5 h-5" /></BtnIcon>
            </Btn>
            <Btn onClick={() => { if (currentIdx < items.length - 1) onSelectItem(items[currentIdx + 1].id); else if (onLoadMore) onLoadMore(); }} disabled={currentIdx >= items.length - 1 && !onLoadMore} colorClass="text-white/50 hover:text-white">
              <BtnLabel text="Next" /><BtnIcon><ChevronRight className="w-5 h-5" /></BtnIcon>
            </Btn>

            <div className="h-px bg-white/10 mx-2" />

            <Btn onClick={resetView} colorClass="text-white/50 hover:text-white">
              <BtnLabel text="Reset View" /><BtnIcon><Maximize className="w-5 h-5" /></BtnIcon>
            </Btn>
            <Btn onClick={() => { if (annotations.length > 0 && window.confirm('Clear all annotations?')) { setAnnotations([]); setSelectedIdx(null); } }} disabled={annotations.length === 0} colorClass="text-white/50 hover:text-red-400 hover:border-red-400/30">
              <BtnLabel text="Clear" /><BtnIcon><Trash2 className="w-5 h-5" /></BtnIcon>
            </Btn>
            <Btn onClick={handleToggleEmpty} colorClass={isEmpty ? 'text-amber-400 border-amber-500/30 bg-amber-900/30' : 'text-white/50 hover:text-white'}>
              <BtnLabel text={isEmpty ? 'Is Empty' : 'Mark Empty'} forceShow={isEmpty} />
              <BtnIcon>{isEmpty ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}</BtnIcon>
            </Btn>

            <div className="h-px bg-white/10 mx-2" />

            <Btn onClick={handleSave} disabled={isSaving} colorClass={saveSuccess ? 'text-blue-400 border-blue-500/30' : 'text-[var(--green)] border-[var(--green)]/30 hover:bg-[var(--green)]/10'}>
              <BtnLabel text={saveSuccess ? 'Saved!' : 'Save'} forceShow={saveSuccess} />
              <BtnIcon>
                {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : saveSuccess ? <Check className="w-5 h-5" /> : <Box className="w-5 h-5" />}
              </BtnIcon>
            </Btn>
            <Btn onClick={onCancel} colorClass="text-white/50 hover:text-red-400 hover:border-red-400/30">
              <BtnLabel text="Close" /><BtnIcon><X className="w-5 h-5" /></BtnIcon>
            </Btn>
          </div>
        </div>
      </div>

      {/* ── Right: Layers Sidebar ─────────────────────────────────────────── */}
      <div className={`${isRightSidebarExpanded ? 'w-72' : 'w-14'} h-full bg-[#080808] border-l border-white/5 flex flex-col shrink-0 z-30 transition-all duration-500`}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className={`transition-opacity duration-300 ${isRightSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
            <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Box className="w-4 h-4 text-[var(--green)]" /> Layers
            </h4>
            <span className="text-[8px] font-black text-white/20 tracking-widest uppercase">{annotations.length} regions</span>
          </div>
          <button
            onClick={() => setIsRightSidebarExpanded(!isRightSidebarExpanded)}
            className="p-2 text-white/30 hover:text-white bg-white/5 rounded-xl transition-all"
          >
            {isRightSidebarExpanded ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        <div
          className={`flex-1 overflow-y-auto p-4 space-y-3 transition-opacity duration-300 ${isRightSidebarExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          style={{ maxHeight: 'calc(100% - 80px)' }}
        >
          {annotations.map((ann, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-3xl border-2 transition-all flex items-center justify-between group cursor-pointer ${selectedIdx === idx ? 'bg-white/5 border-white/30 shadow-lg' : 'border-transparent bg-white/[0.02] hover:bg-white/[0.05]'}`}
              onClick={() => { setSelectedIdx(idx); setInteractionMode('edit'); }}
            >
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: getLabelColor(ann.label) }} />
                <span className="text-[10px] font-black text-white/80 truncate uppercase tracking-tighter">{ann.label || 'Unlabeled'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black text-white/20">#{idx + 1}</span>
                <button
                  onClick={e => { e.stopPropagation(); deleteAnnotation(idx); }}
                  className="p-1.5 text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LabelingCanvas;
