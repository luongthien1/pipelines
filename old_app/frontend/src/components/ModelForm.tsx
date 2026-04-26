import React from 'react';
import type { Task } from '../types';

interface ModelFormProps {
  formValues: {
    name: string;
    description: string;
    task: string;
  };
  tasks: Task[];
  handleFormChange: (field: string, value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}

const ModelForm: React.FC<ModelFormProps> = ({
  formValues,
  tasks,
  handleFormChange,
  onSubmit,
  onCancel,
}) => {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col text-xs font-semibold text-muted uppercase tracking-wider">
          Name
          <input
            value={formValues.name}
            onChange={(e) => handleFormChange('name', e.target.value)}
            required
            placeholder="Model name"
            className="mt-2 rounded-xl border border-border px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-green/20 focus:border-green outline-none transition-all"
          />
        </label>
        <label className="flex flex-col text-xs font-semibold text-muted uppercase tracking-wider">
          Task
          <select
            value={formValues.task}
            onChange={(e) => handleFormChange('task', e.target.value)}
            required
            className="mt-2 rounded-xl border border-border px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-green/20 focus:border-green outline-none transition-all"
          >
            <option value="">Select a task</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col text-xs font-semibold text-muted uppercase tracking-wider">
        Description
        <textarea
          value={formValues.description}
          onChange={(e) => handleFormChange('description', e.target.value)}
          placeholder="Short description"
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
          Create
        </button>
      </div>
    </form>
  );
};

export default ModelForm;
