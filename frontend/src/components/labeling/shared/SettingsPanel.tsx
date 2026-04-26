/**
 * Shared settings panel (top-left of canvas):
 * - Interaction mode switcher
 * - Taxonomy (labels)
 * - AI Auto-Pilot
 * Precisely replicated the 'old app' aesthetic from original LabelingCanvas.tsx.
 */
import React, { useState } from 'react';
import { 
  Zap, 
  Settings, 
  Hand, 
  MousePointer2, 
  PlusCircle, 
  Check,
  ChevronDown
} from 'lucide-react';
import { Select, Slider, Button, Input, Typography, Badge, message, Divider } from 'antd';
import { useModels, useModelVersions, useModelAutoLabel } from '../../../hooks/useApi';
import type { InteractionMode } from './types';

const { Text } = Typography;

interface SettingsPanelProps {
  interactionMode: InteractionMode;
  onModeChange: (m: InteractionMode) => void;
  sessionLabels: string[];
  activeLabel: string;
  onLabelClick: (label: string) => void;
  newLabelInput: string;
  onNewLabelChange: (v: string) => void;
  onAddLabel: (e: React.FormEvent) => void;
  // AI
  datasetTask: string;
  currentItemId: number;
  imgDims: { w: number; h: number };
  onAutoLabel: (detections: any[], confidence: number) => void;
  // Extra slot for task-specific controls (e.g. polygon tools)
  extraControls?: React.ReactNode;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  interactionMode, onModeChange,
  sessionLabels, activeLabel, onLabelClick,
  newLabelInput, onNewLabelChange, onAddLabel,
  datasetTask, currentItemId, imgDims, onAutoLabel,
  extraControls,
}) => {
  const { data: models } = useModels(datasetTask);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const { data: modelVersions } = useModelVersions(selectedModelId || 0);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [confidence, setConfidence] = useState(0.3);
  const autoLabelMutation = useModelAutoLabel(selectedVersionId || 0, currentItemId);

  const handleAutoLabel = async () => {
    if (!selectedVersionId || !imgDims.w) return;
    try {
      let detections = await autoLabelMutation.mutateAsync(confidence);
      detections = detections.filter((d: any) => (d.confidence ?? 1.0) >= confidence);
      onAutoLabel(detections, confidence);
    } catch (err) {
      console.error(err);
      message.error('Auto-labeling failed.');
    }
  };

  const isClassification = (datasetTask || '').toLowerCase().includes('classification');

  return (
    <div className="absolute top-8 left-8 z-40 flex flex-col items-start gap-3 group/dashboard">
      {/* Collapsed Pill (from Original) */}
      <div className="bg-black/90 backdrop-blur-2xl border border-white/10 p-3.5 rounded-2xl flex items-center gap-3 text-white/80 shadow-2xl group-hover/dashboard:hidden cursor-pointer transition-all hover:scale-105 active:scale-95">
        <Settings className="w-5 h-5 text-[var(--green)]" />
        <span className="text-[10px] font-black uppercase tracking-widest bg-white/10 px-2 py-1 rounded-md">
          {interactionMode} mode
        </span>
      </div>

      {/* Expanded Logic (from Original) */}
      <div className="hidden group-hover/dashboard:flex flex-col gap-4 origin-top-left transition-all animate-in fade-in zoom-in-95 duration-300">
        
        {/* Mode Switcher (from Original) */}
        {!isClassification && (
          <div className="flex bg-black/60 border border-white/10 p-1.5 rounded-3xl self-start backdrop-blur-3xl shadow-2xl">
            {([
              { id: 'draw', icon: PlusCircle, label: 'Draw' },
              { id: 'edit', icon: MousePointer2, label: 'Edit' },
              { id: 'nav',  icon: Hand, label: 'Move' },
            ] as const).map(mode => (
              <button
                key={mode.id}
                onClick={() => onModeChange(mode.id)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all duration-300 ${
                  interactionMode === mode.id 
                    ? 'bg-white text-black shadow-lg scale-105' 
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                <mode.icon className="w-4 h-4" />
                <span className={interactionMode === mode.id ? 'block' : 'hidden'}>{mode.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Extra Tools Slot */}
        {extraControls}

        {/* Settings Card (Replicated Visuals from Original) */}
        <div className="bg-black/90 border border-white/10 p-6 rounded-[2.5rem] w-80 space-y-6 shadow-2xl backdrop-blur-3xl">
          
          {/* Taxonomy Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest">Taxonomy</h4>
              <Badge count={sessionLabels.length} style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', fontSize: 9, border: 'none' }} />
            </div>
            
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto no-scrollbar py-1">
              {sessionLabels.map(label => (
                <button
                  key={label}
                  onClick={() => onLabelClick(label)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${
                    activeLabel === label
                      ? 'bg-white text-black ring-4 ring-white/10 shadow-lg'
                      : 'bg-white/5 text-white/50 border border-white/10 hover:border-white/30 hover:text-white/70'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={onAddLabel} className="flex gap-2 relative group/input">
              <input
                type="text"
                value={newLabelInput}
                onChange={(e) => onNewLabelChange(e.target.value)}
                placeholder="New Label..."
                className="flex-1 px-4 py-2 text-[10px] font-bold rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-white/30 transition-all"
              />
              <button
                type="submit"
                className="px-3 bg-white text-black rounded-xl hover:bg-white/90 active:scale-95 transition-all focus:ring-2 ring-white/20"
              >
                <Check className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* AI Auto-Pilot (from Original) */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 text-[var(--green)]">
              <Zap className="w-4 h-4 fill-current" />
              <h4 className="text-[9px] font-black uppercase tracking-wider">AI Auto-Pilot</h4>
            </div>
            
            <div className="space-y-2">
              <Select
                value={selectedModelId || undefined}
                onChange={setSelectedModelId}
                placeholder="Select Model"
                className="w-full modern-select-dark"
                dropdownStyle={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.1)' }}
                suffixIcon={<ChevronDown className="w-3 h-3 opacity-20" />}
              >
                {models?.map(m => (
                  <Select.Option key={m.id} value={m.id}>
                    <span className="text-[10px] font-black uppercase">{m.name}</span>
                  </Select.Option>
                ))}
              </Select>

              {selectedModelId && (
                <Select
                  value={selectedVersionId || undefined}
                  onChange={setSelectedVersionId}
                  placeholder="Version"
                  className="w-full modern-select-dark"
                  dropdownStyle={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  {modelVersions?.map(v => (
                    <Select.Option key={v.id} value={v.id}>
                      <span className="text-[10px] font-bold">{v.version_name}</span>
                    </Select.Option>
                  ))}
                </Select>
              )}

              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Confidence</span>
                  <span className="text-[9px] font-black text-[var(--green)]">{Math.round(confidence * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.05} max={0.95} step={0.05}
                  value={confidence}
                  onChange={(e) => setConfidence(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    accentColor: 'var(--green)',
                    background: `linear-gradient(to right, var(--green) 0%, var(--green) ${((confidence - 0.05) / 0.9) * 100}%, rgba(255,255,255,0.1) ${((confidence - 0.05) / 0.9) * 100}%, rgba(255,255,255,0.1) 100%)`,
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                />
                <div className="flex justify-between text-[8px] text-white/20 font-bold px-1">
                  <span>5%</span><span>50%</span><span>95%</span>
                </div>
              </div>

              <button
                onClick={handleAutoLabel}
                disabled={!selectedVersionId || autoLabelMutation.isPending}
                className={`w-full py-3 mt-2 rounded-2xl text-[9px] font-black transition-all ${
                  !selectedVersionId || autoLabelMutation.isPending
                    ? 'bg-white/5 text-white/20 cursor-not-allowed'
                    : 'bg-[var(--green)] text-white hover:scale-[1.02] shadow-[0_10px_20px_rgba(34,197,94,0.2)] active:scale-[0.98]'
                }`}
              >
                {autoLabelMutation.isPending ? 'Working...' : 'Execute AI'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
