/**
 * ConvertClassTaskForm — configure class name mapping for the "convert class" pipeline task.
 *
 * Config structure saved to task.config:
 * {
 *   class_map: {
 *     "old_name": "new_name",   // rename
 *     "alias":    "new_name",   // merge alias → same target
 *     "remove":   null,         // null = drop this class entirely
 *   }
 * }
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ArrowRight, AlertCircle } from 'lucide-react';
import { useUpdatePipelineTask } from '../../hooks/useApi';

interface Mapping {
  from: string;
  to: string;   // empty string = drop
}

interface ConvertClassTaskFormProps {
  pipelineId: number;
  taskId: number | undefined;
  config: Record<string, any>;
  onSave?: (next: Record<string, any>) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  /** Suggested source labels from the dataset version */
  sourceLabels?: string[];
}

const ConvertClassTaskForm: React.FC<ConvertClassTaskFormProps> = ({
  pipelineId,
  taskId,
  config,
  onSave,
  onDelete,
  sourceLabels = [],
}) => {
  const updateTask = useUpdatePipelineTask(pipelineId);

  // Parse existing class_map into rows
  const parseRows = (cfg: Record<string, any>): Mapping[] => {
    const map = cfg?.class_map || {};
    return Object.entries(map).map(([from, to]) => ({
      from,
      to: to === null ? '' : String(to),
    }));
  };

  const [rows, setRows] = useState<Mapping[]>(() => parseRows(config));
  const [isSaving, setIsSaving] = useState(false);

  // Sync when config changes externally
  useEffect(() => {
    setRows(parseRows(config));
  }, [JSON.stringify(config?.class_map)]); // eslint-disable-line react-hooks/exhaustive-deps

  const addRow = () => setRows(prev => [...prev, { from: '', to: '' }]);

  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx));

  const updateRow = (idx: number, field: 'from' | 'to', value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  // Add all source labels that aren't mapped yet
  const addAllSourceLabels = () => {
    const existing = new Set(rows.map(r => r.from));
    const newRows = sourceLabels
      .filter(l => !existing.has(l))
      .map(l => ({ from: l, to: l }));
    setRows(prev => [...prev, ...newRows]);
  };

  const buildClassMap = (): Record<string, string | null> => {
    const map: Record<string, string | null> = {};
    for (const row of rows) {
      if (!row.from.trim()) continue;
      map[row.from.trim()] = row.to.trim() === '' ? null : row.to.trim();
    }
    return map;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const next = { ...config, class_map: buildClassMap() };
      if (onSave) {
        await onSave(next);
      } else if (taskId) {
        await updateTask.mutateAsync({ id: taskId, config: next });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Detect duplicate "from" values
  const fromCounts = rows.reduce<Record<string, number>>((acc, r) => {
    if (r.from) acc[r.from] = (acc[r.from] || 0) + 1;
    return acc;
  }, {});
  const hasDuplicates = Object.values(fromCounts).some(c => c > 1);

  // Unique target labels (for autocomplete hint)
  const targetLabels = Array.from(new Set(rows.map(r => r.to).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-bold text-sm text-text">Class Mapping</h4>
          <p className="text-xs text-muted mt-1">
            Map source class names to target names before training.
            Leave <strong>Target</strong> empty to <span className="text-red font-bold">drop</span> that class.
          </p>
        </div>
        {sourceLabels.length > 0 && (
          <button
            type="button"
            onClick={addAllSourceLabels}
            className="text-[10px] font-bold text-[var(--green-dark)] hover:underline uppercase tracking-tight shrink-0"
          >
            + Import all labels
          </button>
        )}
      </div>

      {/* Mapping table */}
      <div className="space-y-2">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_32px_1fr_32px] gap-2 px-1">
          <span className="text-[10px] font-black text-muted uppercase tracking-wider">Source label</span>
          <span />
          <span className="text-[10px] font-black text-muted uppercase tracking-wider">Target label</span>
          <span />
        </div>

        {rows.length === 0 && (
          <div className="text-center py-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <p className="text-sm text-muted italic">No mappings defined. Add a row or import labels.</p>
          </div>
        )}

        {rows.map((row, idx) => {
          const isDup = fromCounts[row.from] > 1;
          const isDrop = row.from.trim() !== '' && row.to.trim() === '';
          return (
            <div key={idx} className="grid grid-cols-[1fr_32px_1fr_32px] gap-2 items-center">
              {/* Source */}
              <div className="relative">
                <input
                  type="text"
                  value={row.from}
                  onChange={(e) => updateRow(idx, 'from', e.target.value)}
                  placeholder="e.g. Palm_Healthy"
                  list={`src-labels-${idx}`}
                  className={`w-full px-3 py-2 text-sm rounded-xl border focus:ring-2 focus:ring-[var(--green-light)] focus:outline-none transition-all ${
                    isDup ? 'border-amber-400 bg-amber-50' : 'border-border bg-white'
                  }`}
                />
                <datalist id={`src-labels-${idx}`}>
                  {sourceLabels.map(l => <option key={l} value={l} />)}
                </datalist>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center">
                <ArrowRight className={`w-4 h-4 ${isDrop ? 'text-red' : 'text-muted'}`} />
              </div>

              {/* Target */}
              <div className="relative">
                <input
                  type="text"
                  value={row.to}
                  onChange={(e) => updateRow(idx, 'to', e.target.value)}
                  placeholder={isDrop ? '(drop)' : 'e.g. healthy'}
                  list={`tgt-labels-${idx}`}
                  className={`w-full px-3 py-2 text-sm rounded-xl border focus:ring-2 focus:ring-[var(--green-light)] focus:outline-none transition-all ${
                    isDrop ? 'border-red/30 bg-red-pale text-red placeholder:text-red/40' : 'border-border bg-white'
                  }`}
                />
                <datalist id={`tgt-labels-${idx}`}>
                  {targetLabels.map(l => <option key={l} value={l} />)}
                </datalist>
              </div>

              {/* Delete */}
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="p-1.5 text-muted hover:text-red transition-colors rounded-lg hover:bg-red-pale"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Duplicate warning */}
      {hasDuplicates && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Duplicate source labels detected — only the last mapping will be used.
        </div>
      )}

      {/* Preview summary */}
      {rows.some(r => r.from.trim()) && (
        <div className="bg-gray-50 border border-border rounded-2xl p-4 space-y-2">
          <h5 className="text-[10px] font-black text-muted uppercase tracking-wider">Preview</h5>
          <div className="flex flex-wrap gap-2">
            {Object.entries(buildClassMap()).map(([from, to]) => (
              <span key={from} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                to === null
                  ? 'bg-red-pale border-red/20 text-red'
                  : from === to
                  ? 'bg-gray-100 border-gray-200 text-muted'
                  : 'bg-[var(--green-pale)] border-[var(--green-light)] text-[var(--green-dark)]'
              }`}>
                {from}
                {to !== null && from !== to && <><ArrowRight className="w-3 h-3" />{to}</>}
                {to === null && <span className="ml-1 opacity-60">✕</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-[var(--green-light)] text-[var(--green-dark)] rounded-xl text-sm font-bold hover:bg-[var(--green-pale)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Row
        </button>

        <div className="flex items-center gap-3">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="px-4 py-2 border border-red/20 text-red bg-red-pale rounded-xl text-sm font-bold hover:bg-red/10 transition-colors"
            >
              Delete Task
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || hasDuplicates}
            className="px-6 py-2 bg-[var(--green)] text-white rounded-xl text-sm font-bold hover:bg-[var(--green-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConvertClassTaskForm;
