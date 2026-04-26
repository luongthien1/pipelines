import React, { useState } from 'react';
import { useModels, useCreateModel, useUpdateModel, useDeleteModel, useTasks, formatDate } from '../hooks/useApi';
import { Brain, Plus, Search, Edit2, Trash2 } from 'lucide-react';
import type { Model } from '../types';
import { Link } from 'react-router-dom';
import Modal from './Modal';
import ModelForm from './ModelForm';

const ModelList: React.FC = () => {
  const { data: models, isLoading, error } = useModels();
  const { data: tasks = [] } = useTasks();
  const createModel = useCreateModel();
  const updateModel = useUpdateModel();
  const deleteModel = useDeleteModel();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formValues, setFormValues] = useState({
    name: '',
    description: '',
    task: '',
  });

  const handleFormChange = (field: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isEditing) {
      await updateModel.mutateAsync({ id: isEditing, ...formValues });
      setIsEditing(null);
    } else {
      await createModel.mutateAsync(formValues);
    }
    setIsCreating(false);
    setFormValues({ name: '', description: '', task: '' });
  };

  const handleEdit = (e: React.MouseEvent, model: Model) => {
    e.stopPropagation();
    setFormValues({
      name: model.name,
      description: model.description || '',
      task: model.task || '',
    });
    setIsEditing(model.id);
    setIsCreating(true);
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this model?')) {
      await deleteModel.mutateAsync(id);
    }
  };

  const filteredModels = models?.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (m.task?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (m.owner?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  return (
    <div className="page-shell text-sm">
      <div className="flex justify-end mb-6">
        <button
          type="button"
          onClick={() => setIsCreating((prev) => !prev)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--green)] text-white rounded-lg hover:bg-[var(--green-dark)] transition-all shadow-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {isCreating ? 'Cancel' : 'New Model'}
        </button>
      </div>

      <Modal
        isOpen={isCreating}
        onClose={() => {
          setIsCreating(false);
          setIsEditing(null);
          setFormValues({ name: '', description: '', task: '' });
        }}
        title={isEditing ? "Edit Model" : "Create New Model"}
      >
        <ModelForm
          formValues={formValues}
          tasks={tasks}
          handleFormChange={handleFormChange}
          onSubmit={handleCreate}
          onCancel={() => {
            setIsCreating(false);
            setIsEditing(null);
            setFormValues({ name: '', description: '', task: '' });
          }}
        />
      </Modal>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted">Loading AI models...</div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-red">Error loading models</div>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted w-4 h-4" />
              <input
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-green-light"
              />
            </div>
          </div>

          {/* Model Grid */}
          {filteredModels && filteredModels.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredModels.map((model) => (
                <ModelCard 
                  key={model.id} 
                  model={model} 
                  to={`/models/${model.id}`}
                  onEdit={(e) => handleEdit(e, model)}
                  onDelete={(e) => handleDelete(e, model.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Brain className="w-12 h-12 text-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-text mb-2">No models found</h3>
              <p className="text-muted mb-4">Try a different search or create your first AI model</p>
              <button 
                onClick={() => setIsCreating(true)}
                className="px-4 py-2 bg-[var(--green)] text-white rounded-lg hover:bg-[var(--green-dark)] transition-colors"
              >
                Create Model
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface ModelCardProps {
  model: Model;
  to: string;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

const ModelCard: React.FC<ModelCardProps> = ({ model, to, onEdit, onDelete }) => {
  return (
    <Link to={to} className="bg-surface border border-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer group relative block">
      <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onEdit(e);
          }}
          className="p-1.5 text-muted hover:text-blue hover:bg-blue-pale rounded-md transition-colors"
          title="Edit model"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDelete(e);
          }}
          className="p-1.5 text-muted hover:text-red hover:bg-red-pale rounded-md transition-colors"
          title="Delete model"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-start justify-between mb-3 pr-16">
        <div className="flex-1">
          <h3 className="font-medium text-text mb-1 group-hover:text-[var(--green)] transition-colors">{model.name}</h3>
          {model.description && (
            <p className="text-sm text-muted line-clamp-2">{model.description}</p>
          )}
        </div>
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-pale text-purple">
          {model.task}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-muted mb-3">
        <span>{formatDate(model.created_at)}</span>
      </div>

      <div className="pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">
            {model.versions_count || 0} versions
          </span>
          <div className="text-green hover:text-green-dark text-sm font-medium">
            View Details →
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ModelList;
