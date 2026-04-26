import React from 'react';

interface PipelineFormProps {
  formValues: {
    name: string;
    type: string;
  };
  handleFormChange: (field: string, value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  datasets: Array<{ id: number; name: string }>;
  models: Array<{ id: number; name: string }>;
  selectedDatasetId?: number | null;
  selectedModelId?: number | null;
  onSelectDataset: (id: number | null) => void;
  onSelectModel: (id: number | null) => void;
  datasetVersions: Array<{ id: number; version_name: string }>;
  modelVersions: Array<{ id: number; version_name: string }>;
  selectedDatasetVersionId?: number | null;
  selectedModelVersionId?: number | null;
  onSelectDatasetVersion: (id: number | null) => void;
  onSelectModelVersion: (id: number | null) => void;
}

const PipelineForm: React.FC<PipelineFormProps> = ({
  formValues,
  handleFormChange,
  onSubmit,
  onCancel,
  datasets,
  models,
  selectedDatasetId,
  selectedModelId,
  onSelectDataset,
  onSelectModel,
  datasetVersions,
  modelVersions,
  selectedDatasetVersionId,
  selectedModelVersionId,
  onSelectDatasetVersion,
  onSelectModelVersion,
}) => {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col text-xs font-semibold text-muted uppercase tracking-wider">
          Name
          <input
            value={formValues.name}
            onChange={(e) => handleFormChange('name', e.target.value)}
            placeholder="Pipeline name"
            className="mt-2 rounded-xl border border-border px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-green/20 focus:border-green outline-none transition-all"
          />
        </label>
        <label className="flex flex-col text-xs font-semibold text-muted uppercase tracking-wider">
          Type
          <select
            value={formValues.type}
            onChange={(e) => handleFormChange('type', e.target.value)}
            className="mt-2 rounded-xl border border-border px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-green/20 focus:border-green outline-none transition-all"
          >
            <option value="training">training</option>
            <option value="testing">testing</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col text-xs font-semibold text-muted uppercase tracking-wider">
          Dataset
          <select
            value={selectedDatasetId ?? ''}
            onChange={(e) => onSelectDataset(e.target.value ? Number(e.target.value) : null)}
            className="mt-2 rounded-xl border border-border px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-green/20 focus:border-green outline-none transition-all"
          >
            <option value="">None</option>
            {datasets.map(ds => (
              <option key={ds.id} value={ds.id}>{ds.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs font-semibold text-muted uppercase tracking-wider">
          Dataset Version
          <select
            value={selectedDatasetVersionId ?? ''}
            onChange={(e) => onSelectDatasetVersion(e.target.value ? Number(e.target.value) : null)}
            className="mt-2 rounded-xl border border-border px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-green/20 focus:border-green outline-none transition-all"
            disabled={!selectedDatasetId}
          >
            <option value="">Latest</option>
            {datasetVersions.map(v => (
              <option key={v.id} value={v.id}>{v.version_name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col text-xs font-semibold text-muted uppercase tracking-wider">
          Model
          <select
            value={selectedModelId ?? ''}
            onChange={(e) => onSelectModel(e.target.value ? Number(e.target.value) : null)}
            className="mt-2 rounded-xl border border-border px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-green/20 focus:border-green outline-none transition-all"
          >
            <option value="">None</option>
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs font-semibold text-muted uppercase tracking-wider">
          Model Version
          <select
            value={selectedModelVersionId ?? ''}
            onChange={(e) => onSelectModelVersion(e.target.value ? Number(e.target.value) : null)}
            className="mt-2 rounded-xl border border-border px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-green/20 focus:border-green outline-none transition-all"
            disabled={!selectedModelId}
          >
            <option value="">Latest</option>
            {modelVersions.map(v => (
              <option key={v.id} value={v.id}>{v.version_name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2.5 text-sm font-semibold text-muted hover:text-text transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-8 py-2.5 bg-[var(--green)] text-white rounded-xl hover:bg-[var(--green-dark)] transition-all shadow-md hover:shadow-lg font-bold text-sm"
        >
          Create
        </button>
      </div>
    </form>
  );
};

export default PipelineForm;
