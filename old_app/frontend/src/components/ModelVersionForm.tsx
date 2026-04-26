import React from 'react';

interface ModelVersionFormProps {
  formValues: {
    stage: string;
    status_note: string;
  };
  handleFormChange: (field: string, value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  isEditing: boolean;
}

const ModelVersionForm: React.FC<ModelVersionFormProps> = ({
  formValues,
  handleFormChange,
  onSubmit,
  onCancel,
  isEditing,
}) => {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="flex flex-col text-xs font-semibold text-muted uppercase tracking-wider">
        Stage
        <select
          value={formValues.stage}
          onChange={(e) => handleFormChange('stage', e.target.value)}
          className="mt-2 rounded-xl border border-border px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-green/20 focus:border-green outline-none transition-all"
        >
          <option value="experimental">Experimental</option>
          <option value="development">Development</option>
          <option value="staging">Staging</option>
          <option value="production">Production</option>
          <option value="archived">Archived</option>
        </select>
      </label>

      <label className="flex flex-col text-xs font-semibold text-muted uppercase tracking-wider">
        Status Note
        <textarea
          value={formValues.status_note}
          onChange={(e) => handleFormChange('status_note', e.target.value)}
          placeholder="Short status update or description of this version"
          rows={3}
          className="mt-2 rounded-xl border border-border px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-green/20 focus:border-green outline-none transition-all resize-none"
        />
      </label>

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

export default ModelVersionForm;
