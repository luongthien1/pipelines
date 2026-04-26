/**
 * ClassificationLabeler — Multi-class / Multi-label image classification.
 * 
 * Features:
 * - Select labels from taxonomy to assign to the entire image.
 * - Keyboard shortcuts for fast classification.
 * - AI auto-label: model suggests labels with confidence.
 */
import React, { useState, useEffect } from 'react';
import { Tag } from 'lucide-react';
import LabelerShell, { getLabelColor } from './shared/LabelerShell';
import SettingsPanel from './shared/SettingsPanel';
import type { LabelerProps, LegacyAnnotation } from './shared/types';
import { useViewport } from './shared/useViewport';

const ClassificationLabeler: React.FC<LabelerProps> = ({
  currentId, imageUrl, annotations: initialAnnotations,
  onSave, onCancel, labels: taskLabels, suggestedLabels = [],
  items, onSelectItem, onLoadMore, datasetTask,
  isEmpty: initialIsEmpty = false, onToggleEmpty,
}) => {
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 });
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isEmpty, setIsEmpty] = useState(initialIsEmpty);

  // Annotations (just a list of labels for classification)
  const [annotations, setAnnotations] = useState<LegacyAnnotation[]>(() =>
    initialAnnotations.filter(a => !a.bbox && !a.points)
  );

  // Labels
  const [sessionLabels, setSessionLabels] = useState<string[]>([]);
  const [activeLabel, setActiveLabel] = useState('');
  const [newLabelInput, setNewLabelInput] = useState('');

  const { containerRef, zoom, offset, resetView } = useViewport(imgDims, currentId);

  // Sync on item change
  useEffect(() => {
    setAnnotations(initialAnnotations.filter(a => !a.bbox && !a.points));
    setIsEmpty(initialIsEmpty);
    setIsImageLoading(true);
  }, [currentId, initialAnnotations]);

  useEffect(() => {
    const combined = Array.from(new Set([...taskLabels, ...suggestedLabels]));
    setSessionLabels(combined);
    if (!activeLabel && combined.length > 0) setActiveLabel(combined[0]);
  }, [taskLabels, suggestedLabels]);

  // Keyboard navigation / shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') resetView();
      if (e.key === 'ArrowRight') {
        const idx = items.findIndex(i => i.id === currentId);
        if (idx < items.length - 1) onSelectItem(items[idx + 1].id);
        else if (onLoadMore) onLoadMore();
      }
      if (e.key === 'ArrowLeft') {
        const idx = items.findIndex(i => i.id === currentId);
        if (idx > 0) onSelectItem(items[idx - 1].id);
      }
      // Shortcuts 1-9 for top labels
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1;
        if (idx < sessionLabels.length) toggleLabel(sessionLabels[idx]);
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [currentId, items, sessionLabels]);

  const toggleLabel = (label: string) => {
    setAnnotations(prev => {
      const exists = prev.find(a => a.label === label);
      if (exists) return prev.filter(a => a.label !== label);
      return [...prev, { label }];
    });
  };

  const handleSave = async () => {
    setIsSaving(true); setSaveSuccess(false);
    try {
      await onSave(annotations);
      setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000);
    } finally { setIsSaving(false); }
  };

  const handleToggleEmpty = async () => {
    const nv = !isEmpty; setIsEmpty(nv);
    if (onToggleEmpty) await onToggleEmpty(nv);
  };

  const handleAutoLabel = (detections: any[]) => {
    // For classification, detections usually just have label + confidence
    setAnnotations(detections.map(d => ({ label: d.label, confidence: d.confidence })));
  };

  const canvasContent = (
    <div
      ref={containerRef}
      className="relative h-full w-full select-none overflow-hidden cursor-grab active:cursor-grabbing"
    >
      {isImageLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900 z-50 animate-pulse">
          <Tag className="w-12 h-12 text-white/10 mb-4 animate-bounce" />
          <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Loading...</span>
        </div>
      )}

      <div
        className="absolute will-change-transform flex items-center justify-center min-h-full min-w-full"
        style={{
          left: 0, top: 0,
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <img
          src={imageUrl}
          alt="Classification"
          className="block pointer-events-none shadow-2xl rounded-sm"
          onLoad={(e) => {
            const img = e.currentTarget;
            setIsImageLoading(false);
            setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
          }}
        />
      </div>

      {/* Floating Labels on image preview (static) */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-3 max-w-[80%] pointer-events-none">
        {annotations.map(ann => (
          <div 
            key={ann.label}
            className="px-6 py-3 rounded-2xl bg-black/80 backdrop-blur-3xl border border-white/20 text-white text-[12px] font-black uppercase tracking-widest shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ borderLeft: `4px solid ${getLabelColor(ann.label)}` }}
          >
            {ann.label} {ann.confidence && <span className="ml-2 text-white/30 text-[10px]">{(ann.confidence * 100).toFixed(0)}%</span>}
          </div>
        ))}
      </div>
    </div>
  );

  const settingsPanel = (
    <SettingsPanel
      interactionMode="nav" // Classification only uses 'nav' (panning)
      onModeChange={() => {}} // Disable mode switcher for classification
      sessionLabels={sessionLabels}
      activeLabel={activeLabel}
      onLabelClick={toggleLabel}
      newLabelInput={newLabelInput}
      onNewLabelChange={setNewLabelInput}
      onAddLabel={(e) => {
        e.preventDefault();
        if (!newLabelInput.trim()) return;
        if (!sessionLabels.includes(newLabelInput)) setSessionLabels(prev => [...prev, newLabelInput]);
        toggleLabel(newLabelInput);
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
      layers={annotations.map(a => ({ 
        label: a.label || 'Unlabeled', 
        preview: <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getLabelColor(a.label) }} /> 
      }))}
      selectedIdx={null}
      onSelectLayer={() => {}}
      onDeleteLayer={(idx) => setAnnotations(prev => prev.filter((_, i) => i !== idx))}
      onResetView={resetView}
      onClear={() => { if (annotations.length > 0 && window.confirm('Clear all labels?')) setAnnotations([]); }}
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

export default ClassificationLabeler;
