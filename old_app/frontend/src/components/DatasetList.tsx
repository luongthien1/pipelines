import React, { useState } from 'react';
import { useDatasets, useCreateDataset, useUpdateDataset, useDeleteDataset, useTasks, formatDate } from '../hooks/useApi';
import { Database, Plus, Search, Edit, Trash2 } from 'lucide-react';
import type { Dataset } from '../types';
import { Link } from 'react-router-dom';
import Modal from './Modal';
import DatasetForm from './DatasetForm';

const DatasetList: React.FC = () => {
  const { data: datasets, isLoading, error } = useDatasets();
  const { data: tasks = [] } = useTasks();
  const createDataset = useCreateDataset();
  const updateDataset = useUpdateDataset();
  const deleteDataset = useDeleteDataset();

  const [isCreating, setIsCreating] = useState(false);
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formValues, setFormValues] = useState({
    name: '',
    description: '',
    task: '',
  });
  
  const handleFormChange = (field: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setIsCreating(false);
    setEditingDataset(null);
    setFormValues({ name: '', description: '', task: '' });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (editingDataset) {
      await updateDataset.mutateAsync({
        id: editingDataset.id,
        ...formValues,
      });
    } else {
      await createDataset.mutateAsync(formValues);
    }
    resetForm();
  };

  const handleEdit = (dataset: Dataset) => {
    setEditingDataset(dataset);
    setFormValues({
      name: dataset.name,
      description: dataset.description || '',
      task: dataset.task,
    });
    setIsCreating(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this dataset?')) {
      await deleteDataset.mutateAsync(id);
    }
  };

  const filteredDatasets = datasets?.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (d.task?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  return (
    <div className="page-shell text-sm">
      <div className="flex justify-end mb-6">
        <button
          type="button"
          onClick={() => {
            if (isCreating) resetForm();
            else setIsCreating(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--green)] text-white rounded-lg hover:bg-[var(--green-dark)] transition-all shadow-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {isCreating ? 'Cancel' : 'New Dataset'}
        </button>
      </div>

      <Modal
        isOpen={isCreating}
        onClose={resetForm}
        title={editingDataset ? 'Edit Dataset' : 'Create New Dataset'}
      >
        <DatasetForm
          formValues={formValues}
          tasks={tasks}
          handleFormChange={handleFormChange}
          onSubmit={handleSubmit}
          onCancel={resetForm}
          isEditing={!!editingDataset}
        />
      </Modal>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted">Loading datasets...</div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-red">Error loading datasets</div>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted w-4 h-4" />
              <input
                type="text"
                placeholder="Search datasets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-green-light"
              />
            </div>
          </div>

          {/* Dataset Grid */}
          {filteredDatasets && filteredDatasets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDatasets.map((dataset) => (
                <DatasetCard 
                  key={dataset.id} 
                  dataset={dataset} 
                  to={`/datasets/${dataset.id}`}
                  onEdit={() => handleEdit(dataset)}
                  onDelete={() => handleDelete(dataset.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Database className="w-12 h-12 text-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-text mb-2">No datasets found</h3>
              <p className="text-muted mb-4">Try a different search or create your first dataset</p>
              <button 
                onClick={() => setIsCreating(true)}
                className="px-4 py-2 bg-[var(--green)] text-white rounded-lg hover:bg-[var(--green-dark)] transition-colors"
              >
                Create Dataset
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface DatasetCardProps {
  dataset: Dataset;
  to: string;
  onEdit: () => void;
  onDelete: () => void;
}

const DatasetCard: React.FC<DatasetCardProps> = ({ dataset, to, onEdit, onDelete }) => {
  return (
    <Link to={to} className="bg-surface border border-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer relative group block">
      <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onEdit();
          }}
          className="p-1.5 bg-white border border-border rounded-md hover:text-green transition-colors"
          title="Edit"
        >
          <Edit className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDelete();
          }}
          className="p-1.5 bg-white border border-border rounded-md hover:text-red transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 pr-12">
          <h3 className="font-medium text-text mb-1 group-hover:text-[var(--green)] transition-colors">{dataset.name}</h3>
          {dataset.description && (
            <p className="text-sm text-muted line-clamp-2">{dataset.description}</p>
          )}
        </div>
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-pale text-blue">
          {dataset.task}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <span>Created: {formatDate(dataset.created_at)}</span>
      </div>

      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">
            {dataset.versions_count || 0} versions
          </span>
          <div className="text-green hover:text-green-dark text-sm font-medium">
            View Details →
          </div>
        </div>
      </div>
    </Link>
  );
};

export default DatasetList;
