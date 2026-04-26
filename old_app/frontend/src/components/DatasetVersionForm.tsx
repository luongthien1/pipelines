import React from 'react';

interface DatasetVersionFormProps {
  formValues: {
    version_name: string;
    data_info: string;
  };
  handleFormChange: (field: string, value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  isEditing: boolean;
}

const DatasetVersionForm: React.FC<DatasetVersionFormProps> = ({
  formValues,
  handleFormChange,
  onSubmit,
  onCancel,
  isEditing,
}) => {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-4">
        <label className="flex flex-col text-xs font-semibold text-muted uppercase tracking-wider">
          Version Name
          <input
            value={formValues.version_name}
            onChange={(e) => handleFormChange('version_name', e.target.value)}
            required
            placeholder="e.g. v1, v2..."
            className="mt-2 rounded-xl border border-border px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-green/20 focus:border-green outline-none transition-all"
          />
        </label>

        <label className="flex flex-col text-xs font-semibold text-muted uppercase tracking-wider">
          Description
          <textarea
            value={formValues.data_info}
            onChange={(e) => handleFormChange('data_info', e.target.value)}
            placeholder="Describe what's in this version"
            rows={4}
            className="mt-2 rounded-xl border border-border px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-green/20 focus:border-green outline-none transition-all resize-none"
          />
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
          {isEditing ? 'Update Version' : 'Create Version'}
        </button>
      </div>
    </form>
  );
};

export default DatasetVersionForm;
