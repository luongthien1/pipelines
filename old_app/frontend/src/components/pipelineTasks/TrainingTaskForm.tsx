import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useModelArchitectures, useRunPipeline } from '../../hooks/useApi';

type TrainingTaskConfig = {
  base_model?: string;
  base_model_architecture?: string;
  base_model_version?: number;
  // Core
  epochs?: number;
  imgsz?: number;
  batch?: number;
  // Optimizer
  optimizer?: string;
  lr0?: number;
  lrf?: number;
  momentum?: number;
  weight_decay?: number;
  warmup_epochs?: number;
  // Augmentation
  mosaic?: number;
  mixup?: number;
  copy_paste?: number;
  flipud?: number;
  fliplr?: number;
  degrees?: number;
  translate?: number;
  scale?: number;
};

const OPTIMIZERS = ['SGD', 'Adam', 'AdamW', 'NAdam', 'RAdam', 'RMSProp'];

const fallbackArchitectures = [
  {
    id: 'yolo',
    name: 'YOLO',
    versions: [11, 12, 26],
    base_models: [
      { id: 'yolo11', label: 'YOLO11', architecture: 'YOLO', version: 11 },
      { id: 'yolo12', label: 'YOLO12', architecture: 'YOLO', version: 12 },
      { id: 'yolo26', label: 'YOLO26', architecture: 'YOLO', version: 26 },
    ],
  },
  {
    id: 'detr',
    name: 'DETR',
    versions: [1, 2],
    base_models: [
      { id: 'detr_resnet50',  label: 'DETR ResNet-50',  architecture: 'DETR', version: 1 },
      { id: 'detr_resnet101', label: 'DETR ResNet-101', architecture: 'DETR', version: 2 },
    ],
  },
];

/**
 * NumInput — uses a string buffer so the user can type freely (e.g. "0.0", "0.05").
 * The numeric value is only committed on blur or when the parent form submits.
 */
const NumInput: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  fallback: number;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
}> = ({ label, value, onChange, fallback, step = 1, min, max, hint }) => {
  // Keep a local string buffer so partial input like "0." isn't immediately coerced
  const [raw, setRaw] = useState(String(value));

  // Sync buffer when the parent value changes (e.g. after save/reload)
  // but only if the user isn't mid-edit (raw already represents the same number)
  useEffect(() => {
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed === value) return; // already in sync
    setRaw(String(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = useCallback(() => {
    const n = parseFloat(raw);
    if (!isFinite(n)) {
      setRaw(String(value)); // revert to last valid
      return;
    }
    const clamped = min !== undefined && n < min ? min
                  : max !== undefined && n > max ? max
                  : n;
    onChange(clamped);
    setRaw(String(clamped));
  }, [raw, value, min, max, onChange]);

  return (
    <label className="flex flex-col text-xs font-semibold text-muted uppercase tracking-wider">
      <span className="flex items-center gap-1">
        {label}
        {hint && <span className="normal-case font-normal text-[10px] text-muted/60">({hint})</span>}
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={raw}
        step={step}
        min={min}
        max={max}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        className="mt-2 rounded-xl border border-border px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-green/20 focus:border-green outline-none transition-all"
      />
    </label>
  );
};

const TrainingTaskForm: React.FC<{
  pipelineId: number;
  config: TrainingTaskConfig;
  onSave: (next: TrainingTaskConfig) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}> = ({ pipelineId, config, onSave, onDelete }) => {
  const { data: architecturesResponse } = useModelArchitectures();
  const runPipeline = useRunPipeline();
  const architectures =
    architecturesResponse && architecturesResponse.length > 0 ? architecturesResponse : fallbackArchitectures;

  // Model
  const [architectureId, setArchitectureId] = useState(architectures[0]?.id || 'yolo');
  const [baseModelId, setBaseModelId] = useState<string>(architectures[0]?.base_models?.[0]?.id || 'yolo11');

  // Core
  const [epochs, setEpochs] = useState<number>(config.epochs ?? 1);
  const [imgsz, setImgsz] = useState<number>(config.imgsz ?? 640);
  const [batch, setBatch] = useState<number>(config.batch ?? 16);

  // Optimizer
  const [optimizer, setOptimizer] = useState<string>(config.optimizer ?? 'SGD');
  const [lr0, setLr0] = useState<number>(config.lr0 ?? 0.01);
  const [lrf, setLrf] = useState<number>(config.lrf ?? 0.01);
  const [momentum, setMomentum] = useState<number>(config.momentum ?? 0.937);
  const [weightDecay, setWeightDecay] = useState<number>(config.weight_decay ?? 0.0005);
  const [warmupEpochs, setWarmupEpochs] = useState<number>(config.warmup_epochs ?? 3);

  // Augmentation
  const [mosaic, setMosaic] = useState<number>(config.mosaic ?? 1.0);
  const [mixup, setMixup] = useState<number>(config.mixup ?? 0.0);
  const [copyPaste, setCopyPaste] = useState<number>(config.copy_paste ?? 0.0);
  const [flipud, setFlipud] = useState<number>(config.flipud ?? 0.0);
  const [fliplr, setFliplr] = useState<number>(config.fliplr ?? 0.5);
  const [degrees, setDegrees] = useState<number>(config.degrees ?? 0.0);
  const [translate, setTranslate] = useState<number>(config.translate ?? 0.1);
  const [scale, setScale] = useState<number>(config.scale ?? 0.5);

  const [isSaving, setIsSaving] = useState(false);

  const selectedArchitecture = useMemo(
    () => architectures.find((a) => a.id === architectureId) || architectures[0],
    [architectures, architectureId]
  );
  const availableBaseModels = selectedArchitecture?.base_models || [];
  const selectedBaseModel = useMemo(
    () => availableBaseModels.find((m) => m.id === baseModelId) || availableBaseModels[0],
    [availableBaseModels, baseModelId]
  );

  // Sync state from config prop — only when config actually has a defined value.
  // Using a stable JSON key to avoid re-running on every render.
  const configKey = JSON.stringify(config);
  useEffect(() => {
    const archIdFromConfig = config.base_model_architecture?.toLowerCase();
    const matchedArch = architectures.find(
      (a) => a.id === archIdFromConfig || a.name.toLowerCase() === archIdFromConfig
    );
    const finalArchId = matchedArch?.id || architectures[0]?.id || 'yolo';

    const verFromConfig = typeof config.base_model_version === 'number' ? config.base_model_version : undefined;
    const verFromString = (() => {
      if (!config.base_model) return undefined;
      const m = String(config.base_model).match(/YOLO[-_ ]?(11|12|26)\b/i);
      return m ? Number(m[1]) : undefined;
    })();
    const ver = verFromConfig ?? verFromString ?? 11;
    const arch = matchedArch || architectures[0];
    const matchModel = (arch?.base_models || []).find((m) => m.version === ver) || (arch?.base_models || [])[0];

    setArchitectureId(finalArchId);
    setBaseModelId(matchModel?.id || 'yolo11');

    // Only overwrite a field if the config actually provides a value for it.
    // This prevents a missing key from resetting a user-edited value to the default.
    if (config.epochs        !== undefined) setEpochs(config.epochs);
    if (config.imgsz         !== undefined) setImgsz(config.imgsz);
    if (config.batch         !== undefined) setBatch(config.batch);
    if (config.optimizer     !== undefined) setOptimizer(config.optimizer);
    if (config.lr0           !== undefined) setLr0(config.lr0);
    if (config.lrf           !== undefined) setLrf(config.lrf);
    if (config.momentum      !== undefined) setMomentum(config.momentum);
    if (config.weight_decay  !== undefined) setWeightDecay(config.weight_decay);
    if (config.warmup_epochs !== undefined) setWarmupEpochs(config.warmup_epochs);
    if (config.mosaic        !== undefined) setMosaic(config.mosaic);
    if (config.mixup         !== undefined) setMixup(config.mixup);
    if (config.copy_paste    !== undefined) setCopyPaste(config.copy_paste);
    if (config.flipud        !== undefined) setFlipud(config.flipud);
    if (config.fliplr        !== undefined) setFliplr(config.fliplr);
    if (config.degrees       !== undefined) setDegrees(config.degrees);
    if (config.translate     !== undefined) setTranslate(config.translate);
    if (config.scale         !== undefined) setScale(config.scale);
  }, [configKey, architectures]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDetr = selectedArchitecture?.id === 'detr';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const arch = selectedBaseModel?.architecture || 'YOLO';
      const ver = selectedBaseModel?.version || 11;
      const baseConfig: TrainingTaskConfig = {
        base_model: selectedBaseModel?.label || `YOLO${ver}`,
        base_model_architecture: arch,
        base_model_version: ver,
        epochs, imgsz, batch,
        optimizer, lr0, lrf, momentum, weight_decay: weightDecay, warmup_epochs: warmupEpochs,
      };
      // Augmentation params only apply to YOLO
      if (!isDetr) {
        Object.assign(baseConfig, { mosaic, mixup, copy_paste: copyPaste, flipud, fliplr, degrees, translate, scale });
      }
      await onSave(baseConfig);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── Model ── */}
      <section>
        <h4 className="text-[10px] font-black text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
          <span className="w-1.5 h-4 rounded-full bg-[var(--green)] inline-block" />
          Model
        </h4>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col text-xs font-semibold text-muted uppercase tracking-wider">
            Architecture
            <select
              value={architectureId}
              onChange={(e) => {
                const nextArch = architectures.find((a) => a.id === e.target.value) || architectures[0];
                setArchitectureId(e.target.value);
                setBaseModelId(nextArch?.base_models?.[0]?.id || baseModelId);
              }}
              className="mt-2 rounded-xl border border-border px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-green/20 focus:border-green outline-none transition-all"
            >
              {architectures.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs font-semibold text-muted uppercase tracking-wider">
            Base Model
            <select
              value={baseModelId}
              onChange={(e) => setBaseModelId(e.target.value)}
              className="mt-2 rounded-xl border border-border px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-green/20 focus:border-green outline-none transition-all"
            >
              {availableBaseModels.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
        </div>
      </section>

      {/* ── Core Hyperparams ── */}
      <section>
        <h4 className="text-[10px] font-black text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
          <span className="w-1.5 h-4 rounded-full bg-blue inline-block" />
          Training
          {isDetr && (
            <span className="normal-case font-normal text-[10px] bg-blue-pale text-blue px-2 py-0.5 rounded-full ml-1">
              Transformer — augmentation not applicable
            </span>
          )}
        </h4>
        <div className="grid gap-4 md:grid-cols-3">
          <NumInput label="Epochs" value={epochs} onChange={setEpochs} fallback={1} min={1} />
          <NumInput label="Image Size" value={imgsz} onChange={setImgsz} fallback={640} step={32} min={32} hint="px" />
          <NumInput label="Batch Size" value={batch} onChange={setBatch} fallback={16} min={1} />
        </div>
      </section>

      {/* ── Optimizer ── */}
      <section>
        <h4 className="text-[10px] font-black text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
          <span className="w-1.5 h-4 rounded-full bg-amber inline-block" />
          Optimizer
        </h4>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col text-xs font-semibold text-muted uppercase tracking-wider">
            Optimizer
            <select
              value={optimizer}
              onChange={(e) => setOptimizer(e.target.value)}
              className="mt-2 rounded-xl border border-border px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-green/20 focus:border-green outline-none transition-all"
            >
              {OPTIMIZERS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <NumInput label="LR₀" value={lr0} onChange={setLr0} fallback={0.01} step={0.001} min={0} hint="initial" />
          <NumInput label="LRf" value={lrf} onChange={setLrf} fallback={0.01} step={0.001} min={0} hint="final factor" />
          <NumInput label="Momentum" value={momentum} onChange={setMomentum} fallback={0.937} step={0.001} min={0} max={1} />
          <NumInput label="Weight Decay" value={weightDecay} onChange={setWeightDecay} fallback={0.0005} step={0.0001} min={0} />
          <NumInput label="Warmup Epochs" value={warmupEpochs} onChange={setWarmupEpochs} fallback={3} step={0.5} min={0} />
        </div>
      </section>

      {/* ── Augmentation — YOLO only ── */}
      {!isDetr && (
      <section>
        <h4 className="text-[10px] font-black text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
          <span className="w-1.5 h-4 rounded-full bg-purple inline-block" />
          Augmentation
          <span className="normal-case font-normal text-[10px] text-muted/60 ml-1">0.0 = off, 1.0 = max</span>
        </h4>
        <div className="grid gap-4 md:grid-cols-4">
          <NumInput label="Mosaic"      value={mosaic}     onChange={setMosaic}     fallback={1.0} step={0.1}  min={0} max={1}   hint="4-img mix" />
          <NumInput label="Mixup"       value={mixup}      onChange={setMixup}      fallback={0.0} step={0.1}  min={0} max={1}   hint="blend 2 imgs" />
          <NumInput label="Copy Paste"  value={copyPaste}  onChange={setCopyPaste}  fallback={0.0} step={0.1}  min={0} max={1}   hint="seg only" />
          <NumInput label="Flip UD"     value={flipud}     onChange={setFlipud}     fallback={0.0} step={0.1}  min={0} max={1}   hint="vertical" />
          <NumInput label="Flip LR"     value={fliplr}     onChange={setFliplr}     fallback={0.5} step={0.1}  min={0} max={1}   hint="horizontal" />
          <NumInput label="Degrees"     value={degrees}    onChange={setDegrees}    fallback={0.0} step={5}    min={0} max={180} hint="rotation °" />
          <NumInput label="Translate"   value={translate}  onChange={setTranslate}  fallback={0.1} step={0.05} min={0} max={0.9} hint="shift ±" />
          <NumInput label="Scale"       value={scale}      onChange={setScale}      fallback={0.5} step={0.1}  min={0} max={0.9} hint="zoom ±" />
        </div>
      </section>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center justify-center px-6 py-2 bg-[var(--green)] text-white rounded-lg hover:bg-[var(--green-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm font-bold text-sm min-w-[80px]"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => runPipeline.mutate(pipelineId)}
          disabled={runPipeline.isPending}
          className="inline-flex items-center justify-center px-6 py-2 bg-[var(--blue)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm font-bold text-sm min-w-[80px]"
        >
          {runPipeline.isPending ? 'Running...' : 'Run'}
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center justify-center px-6 py-2 border border-red/20 text-red bg-red-pale rounded-lg hover:bg-red/10 transition-all shadow-sm font-bold text-sm min-w-[80px]"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
};

export default TrainingTaskForm;
