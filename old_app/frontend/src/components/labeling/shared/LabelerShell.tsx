/**
 * LabelerShell — shared outer layout used by all labeler types.
 * Provides: left image strip, canvas area, right layers panel, action toolbar.
 */
import React from 'react';
import {
  Trash2, Check, X, Box, Maximize, ChevronRight, ChevronLeft,
  Circle, CheckCircle2, Tag,
} from 'lucide-react';
import { BACKEND_URL } from '../../../hooks/useApi';

const LABEL_COLORS = [
  '#EF4444','#3B82F6','#10B981','#F59E0B','#8B5CF6',
  '#EC4899','#06B6D4','#F97316','#14B8A6','#6366F1',
];
export const getLabelColor = (label?: string) => {
  if (!label) return LABEL_COLORS[0];
  let h = 0;
  for (let i = 0; i < label.length; i++) h = label.charCodeAt(i) + ((h << 5) - h);
  return LABEL_COLORS[Math.abs(h) % LABEL_COLORS.length];
};

// ── Toolbar helpers ────────────────────────────────────────────────────────

export const ToolbarBtn: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  colorClass: string;
  children: React.ReactNode;
}> = ({ onClick, disabled = false, colorClass, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`group/btn flex items-center justify-end h-11 rounded-2xl bg-black/50 border border-white/10 backdrop-blur-xl transition-all duration-200 overflow-hidden disabled:opacity-20 disabled:cursor-not-allowed ${colorClass}`}
  >
    {children}
  </button>
);

export const TBIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="w-11 h-11 flex items-center justify-center shrink-0">{children}</span>
);

export const TBLabel: React.FC<{ text: string; forceShow?: boolean }> = ({ text, forceShow = false }) => (
  <span className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap pr-4 transition-all duration-200 overflow-hidden
    ${forceShow ? 'max-w-[120px] opacity-100' : 'max-w-0 opacity-0 group-hover/btn:max-w-[120px] group-hover/btn:opacity-100'}`}>
    {text}
  </span>
);

// ── Shell ──────────────────────────────────────────────────────────────────

interface ShellProps {
  // Image strip
  items: any[];
  currentId: number;
  onSelectItem: (id: number) => void;
  // Canvas
  canvasContent: React.ReactNode;
  settingsPanel: React.ReactNode;
  // Layers sidebar
  layers: { label?: string; preview?: React.ReactNode }[];
  selectedIdx: number | null;
  onSelectLayer: (idx: number) => void;
  onDeleteLayer: (idx: number) => void;
  // Actions
  onResetView: () => void;
  onClear: () => void;
  onSave: () => void;
  onCancel: () => void;
  onToggleEmpty: () => void;
  isEmpty: boolean;
  isSaving: boolean;
  saveSuccess: boolean;
  onLoadMore?: () => void;
}

const LabelerShell: React.FC<ShellProps> = ({
  items, currentId, onSelectItem,
  canvasContent, settingsPanel,
  layers, selectedIdx, onSelectLayer, onDeleteLayer,
  onResetView, onClear, onSave, onCancel, onToggleEmpty,
  isEmpty, isSaving, saveSuccess, onLoadMore,
}) => {
  const [rightExpanded, setRightExpanded] = React.useState(true);
  const currentIdx = items.findIndex(i => i.id === currentId);

  // Visible strip items
  const [visibleItems, setVisibleItems] = React.useState<any[]>([]);
  React.useEffect(() => {
    if (currentIdx === -1) { setVisibleItems(items.slice(0, 20)); return; }
    const start = Math.max(0, currentIdx - 10);
    const end = Math.min(items.length, start + 20);
    setVisibleItems(items.slice(start, end));
    if (currentIdx > items.length - 2 && onLoadMore) onLoadMore();
  }, [items, currentId, onLoadMore]);

  return (
    <div className="flex h-full w-full bg-[#0a0a0a] overflow-hidden relative shrink-0">
      {/* ── Left image strip ── */}
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
                <div className="absolute top-1.5 right-1.5 bg-[var(--green)] text-white p-1 rounded-md z-10">
                  <Tag className="w-3 h-3" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Canvas area ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-black relative p-6 h-full">
        <div className="relative h-full w-full bg-[#0c0c0c] rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl">
          {/* Settings panel top-left */}
          {settingsPanel}

          {/* Canvas content (image + annotations) */}
          {canvasContent}

          {/* Vertical action toolbar */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-40">
            <ToolbarBtn onClick={() => { if (currentIdx > 0) onSelectItem(items[currentIdx - 1].id); }} disabled={currentIdx <= 0} colorClass="text-white/50 hover:text-white">
              <TBLabel text="Previous" /><TBIcon><ChevronLeft className="w-5 h-5" /></TBIcon>
            </ToolbarBtn>
            <ToolbarBtn onClick={() => { if (currentIdx < items.length - 1) onSelectItem(items[currentIdx + 1].id); else if (onLoadMore) onLoadMore(); }} disabled={currentIdx >= items.length - 1 && !onLoadMore} colorClass="text-white/50 hover:text-white">
              <TBLabel text="Next" /><TBIcon><ChevronRight className="w-5 h-5" /></TBIcon>
            </ToolbarBtn>
            <div className="h-px bg-white/10 mx-2" />
            <ToolbarBtn onClick={onResetView} colorClass="text-white/50 hover:text-white">
              <TBLabel text="Reset View" /><TBIcon><Maximize className="w-5 h-5" /></TBIcon>
            </ToolbarBtn>
            <ToolbarBtn onClick={onClear} disabled={layers.length === 0} colorClass="text-white/50 hover:text-red hover:border-red/30">
              <TBLabel text="Clear" /><TBIcon><Trash2 className="w-5 h-5" /></TBIcon>
            </ToolbarBtn>
            <ToolbarBtn onClick={onToggleEmpty} colorClass={isEmpty ? 'text-amber-400 border-amber-500/30 bg-amber-900/30' : 'text-white/50 hover:text-white'}>
              <TBLabel text={isEmpty ? 'Is Empty' : 'Mark Empty'} forceShow={isEmpty} />
              <TBIcon>{isEmpty ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}</TBIcon>
            </ToolbarBtn>
            <div className="h-px bg-white/10 mx-2" />
            <ToolbarBtn onClick={onSave} disabled={isSaving} colorClass={saveSuccess ? 'text-blue-400 border-blue-500/30' : 'text-[var(--green)] border-[var(--green)]/30 hover:bg-[var(--green)]/10'}>
              <TBLabel text={saveSuccess ? 'Saved!' : 'Save'} forceShow={saveSuccess} />
              <TBIcon>
                {isSaving
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : saveSuccess ? <Check className="w-5 h-5" /> : <Box className="w-5 h-5" />
                }
              </TBIcon>
            </ToolbarBtn>
            <ToolbarBtn onClick={onCancel} colorClass="text-white/50 hover:text-red hover:border-red/30">
              <TBLabel text="Close" /><TBIcon><X className="w-5 h-5" /></TBIcon>
            </ToolbarBtn>
          </div>
        </div>
      </div>

      {/* ── Right layers panel ── */}
      <div className={`${rightExpanded ? 'w-72' : 'w-14'} h-full bg-[#080808] border-l border-white/5 flex flex-col shrink-0 z-30 transition-all duration-500`}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className={`transition-opacity duration-300 ${rightExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
            <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Box className="w-4 h-4 text-[var(--green)]" /> Layers
            </h4>
            <span className="text-[8px] font-black text-muted tracking-widest uppercase">{layers.length} regions</span>
          </div>
          <button onClick={() => setRightExpanded(!rightExpanded)} className="p-2 text-white/30 hover:text-white bg-white/5 rounded-xl transition-all">
            {rightExpanded ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        <div className={`flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar transition-opacity duration-300 ${rightExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} style={{ maxHeight: 'calc(100% - 80px)' }}>
          {layers.map((layer, idx) => (
            <div
              key={idx}
              onClick={() => onSelectLayer(idx)}
              className={`p-4 rounded-3xl border-2 transition-all flex items-center justify-between group cursor-pointer ${
                selectedIdx === idx ? 'bg-white/5 border-white/30 shadow-lg' : 'border-transparent bg-white/[0.02] hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex items-center gap-4 overflow-hidden">
                {layer.preview ?? (
                  <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: getLabelColor(layer.label) }} />
                )}
                <span className="text-[10px] font-black text-white/80 truncate uppercase tracking-tighter">
                  {layer.label || 'Unlabeled'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black text-white/20">#{idx + 1}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteLayer(idx); }}
                  className="p-1.5 text-white/20 hover:text-red opacity-0 group-hover:opacity-100 transition-all"
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

export default LabelerShell;
