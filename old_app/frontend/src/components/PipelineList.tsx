import React, { useEffect, useState } from 'react';
import { usePipelines, useCreatePipeline, useUpdatePipeline, useDeletePipeline, useDatasets, useModels, useDatasetVersions, useModelVersions, formatDate, useRunPipeline, usePipelineTasks, useUpdatePipelineTask, useCancelPipeline, useCancelPipelineTask, useVersionLabels } from '../hooks/useApi';
import { Workflow, Plus, Search, Play, CheckCircle, XCircle, Pause, ArrowRight, Edit2, Trash2, X, Database, StopCircle } from 'lucide-react';
import type { Pipeline, PipelineTask } from '../types';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Modal from './Modal';
import PipelineForm from './PipelineForm';
import TrainingTaskForm from './pipelineTasks/TrainingTaskForm';
import ConvertClassTaskForm from './pipelineTasks/ConvertClassTaskForm';

const PipelineList: React.FC = () => {
  const { data: pipelines, isLoading, error } = usePipelines();
  const { data: datasets = [] } = useDatasets();
  const { data: models = [] } = useModels();
  const createPipeline = useCreatePipeline();
  const updatePipeline = useUpdatePipeline();
  const deletePipeline = useDeletePipeline();
  const runPipeline = useRunPipeline();
  const cancelPipeline = useCancelPipeline();

  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formValues, setFormValues] = useState({ name: '', type: 'training' });
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const { data: datasetVersions = [] } = useDatasetVersions(selectedDatasetId || 0);
  const { data: modelVersions = [] } = useModelVersions(selectedModelId || 0);
  const [selectedDatasetVersionId, setSelectedDatasetVersionId] = useState<number | null>(null);
  const [selectedModelVersionId, setSelectedModelVersionId] = useState<number | null>(null);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);
  const [activeDetailTab, setActiveDetailTab] = useState<'config' | 'logs'>('config');

  // Add-task modal
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);

  // Drag state for step reordering
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const navigate = useNavigate();
  const params = useParams();
  const selectedPipelineId = params.pipelineId ? Number(params.pipelineId) : null;

  const cancelTask = useCancelPipelineTask(selectedPipelineId || 0);

  // Load tasks for the selected pipeline — each task has its own config
  const { data: pipelineTasks = [] } = usePipelineTasks(selectedPipelineId || 0);
  const updatePipelineTask = useUpdatePipelineTask(selectedPipelineId || 0);

  const selectedPipeline = selectedPipelineId ? (pipelines || []).find((p) => p.id === selectedPipelineId) : null;
  const selectedSteps: string[] = Array.isArray(selectedPipeline?.config?.steps) ? selectedPipeline.config.steps : [];
  const activeTaskName = selectedSteps[selectedTaskIndex] || selectedSteps[0] || '';

  // Source labels from the pipeline's dataset version (for ConvertClassTaskForm)
  const datasetVersionIdForLabels = selectedPipeline?.dataset_version_id || 0;
  const { data: sourceLabels = [] } = useVersionLabels(datasetVersionIdForLabels);

  // Match the Task DB record to the active step by task_type name
  const activeTask: PipelineTask | undefined =
    pipelineTasks.find((t) => t.task_type.toLowerCase() === activeTaskName.toLowerCase()) ??
    pipelineTasks[selectedTaskIndex];

  const hasDetail = !!selectedPipeline;

  const filteredPipelines = (pipelines || []).filter((p) =>
    (p.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (p.type?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (p.status?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const handleFormChange = (field: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const openCreateModal = () => {
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    setFormValues({ name: `pipeline_${ts}`, type: 'training' });
    setIsCreating(true);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const finalName = formValues.name.trim() || `pipeline_${Date.now()}`;
    if (isEditing) {
      await updatePipeline.mutateAsync({ id: isEditing, name: finalName, type: formValues.type as any, dataset_version_id: selectedDatasetVersionId || undefined, model_version_id: selectedModelVersionId || undefined } as any);
      setIsEditing(null);
    } else {
      await createPipeline.mutateAsync({ name: finalName, type: formValues.type as any, dataset_version_id: selectedDatasetVersionId || undefined, model_version_id: selectedModelVersionId || undefined } as any);
    }
    setIsCreating(false);
    setFormValues({ name: '', type: 'training' });
    setSelectedDatasetId(null);
    setSelectedModelId(null);
    setSelectedDatasetVersionId(null);
    setSelectedModelVersionId(null);
  };

  const handleEdit = (e: React.MouseEvent, pipeline: Pipeline) => {
    e.stopPropagation();
    setFormValues({ name: pipeline.name || '', type: pipeline.type });
    setIsEditing(pipeline.id);
    setIsCreating(true);
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this pipeline?')) {
      await deletePipeline.mutateAsync(id);
      if (selectedPipelineId === id) navigate('/pipelines');
    }
  };

  useEffect(() => {
    setSelectedTaskIndex(0);
    setActiveDetailTab('config');
  }, [selectedPipelineId]);

  useEffect(() => {
    setActiveDetailTab('config');
  }, [selectedTaskIndex]);

  // Sync dataset selector with the active task's saved config on task switch
  useEffect(() => {
    const savedVersionId = activeTask?.config?.dataset_version_id ?? selectedPipeline?.dataset_version_id;
    if (savedVersionId) {
      setSelectedDatasetVersionId(savedVersionId);
      // Also sync the parent dataset id so the version dropdown loads
      const datasetId = selectedPipeline?.dataset_version?.dataset_id;
      if (datasetId) setSelectedDatasetId(datasetId);
    }
  }, [activeTask?.id, selectedPipeline?.dataset_version_id, selectedPipeline?.dataset_version?.dataset_id]);

  return (
    <div className="page-shell text-sm">
      <div className="flex gap-6">
        {/* Left: Pipeline list */}
        <div className={hasDetail ? 'w-[18%] min-w-[180px] max-w-[240px] shrink-0 transition-all duration-300 ease-out bg-surface border border-border rounded-2xl p-4' : 'w-full transition-all duration-300 ease-out'}>
          <div className="flex justify-end mb-6">
            <button type="button" onClick={openCreateModal} className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--green)] text-white rounded-lg hover:bg-[var(--green-dark)] transition-all shadow-sm font-medium">
              <Plus className="w-4 h-4" />
              New Pipeline
            </button>
          </div>

          <Modal isOpen={isCreating} onClose={() => { setIsCreating(false); setIsEditing(null); setFormValues({ name: '', type: 'training' }); }} title={isEditing ? 'Edit Pipeline' : 'Create New Pipeline'}>
            <PipelineForm
              formValues={formValues}
              handleFormChange={handleFormChange}
              onSubmit={handleCreate}
              onCancel={() => { setIsCreating(false); setIsEditing(null); setFormValues({ name: '', type: 'training' }); }}
              datasets={datasets}
              models={models}
              selectedDatasetId={selectedDatasetId}
              selectedModelId={selectedModelId}
              onSelectDataset={setSelectedDatasetId}
              onSelectModel={setSelectedModelId}
              datasetVersions={datasetVersions}
              modelVersions={modelVersions}
              selectedDatasetVersionId={selectedDatasetVersionId}
              selectedModelVersionId={selectedModelVersionId}
              onSelectDatasetVersion={setSelectedDatasetVersionId}
              onSelectModelVersion={setSelectedModelVersionId}
            />
          </Modal>

          {isLoading ? (
            <div className="flex items-center justify-center h-64"><div className="text-muted">Loading pipelines...</div></div>
          ) : error ? (
            <div className="flex items-center justify-center h-64"><div className="text-red">Error loading pipelines</div></div>
          ) : (
            <>
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
                  <input type="text" placeholder="Search pipelines..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-green-light" />
                </div>
              </div>
              {filteredPipelines.length > 0 ? (
                <div className="space-y-4">
                  {filteredPipelines.map((pipeline) => (
                    <PipelineCard key={pipeline.id} pipeline={pipeline} onEdit={(e) => handleEdit(e, pipeline)} onDelete={(e) => handleDelete(e, pipeline.id)} onCancel={() => cancelPipeline.mutate(pipeline.id)} compact={hasDetail} active={pipeline.id === selectedPipelineId} detailTo={`/pipelines/${pipeline.id}`} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Workflow className="w-12 h-12 text-muted mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-text mb-2">No pipelines found</h3>
                  <p className="text-muted mb-4">Try a different search or create your first pipeline</p>
                  <button onClick={() => setIsCreating(true)} className="px-4 py-2 bg-[var(--green)] text-white rounded-lg hover:bg-[var(--green-dark)] transition-colors">Create Pipeline</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Pipeline detail */}
        <div className={`min-w-0 bg-surface border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col transition-all duration-300 ease-out ${hasDetail ? 'flex-1 opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-8 pointer-events-none border-transparent'}`}>
          {selectedPipeline && (
            <>
              {/* Step breadcrumb header — with drag-to-reorder and add-task modal */}
              <div className="p-4 relative">
                <button type="button" onClick={() => navigate('/pipelines')} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 transition-colors text-muted z-20">
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3 overflow-x-auto pr-12">
                  {selectedSteps.map((t, idx) => (
                    <React.Fragment key={`${t}-${idx}`}>
                      {/* Drop zone before this step */}
                      {dragIdx !== null && dragIdx !== idx && dragOverIdx === idx && (
                        <div className="w-1 h-10 bg-[var(--green)] rounded-full shrink-0 transition-all" />
                      )}
                      <div
                        className="relative shrink-0 group"
                        draggable
                        onDragStart={() => setDragIdx(idx)}
                        onDragEnd={async () => {
                          if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
                            const next = [...selectedSteps];
                            const [moved] = next.splice(dragIdx, 1);
                            next.splice(dragOverIdx > dragIdx ? dragOverIdx - 1 : dragOverIdx, 0, moved);
                            await updatePipeline.mutateAsync({ id: selectedPipeline.id, config: { steps: next } } as any);
                            setSelectedTaskIndex(dragOverIdx > dragIdx ? dragOverIdx - 1 : dragOverIdx);
                          }
                          setDragIdx(null);
                          setDragOverIdx(null);
                        }}
                        onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedTaskIndex(idx)}
                          className={`px-5 py-2.5 rounded-xl border text-sm font-extrabold transition-all flex items-center gap-2 cursor-grab active:cursor-grabbing ${
                            dragIdx === idx ? 'opacity-40 scale-95' : ''
                          } ${idx === selectedTaskIndex ? 'bg-[var(--green-pale)] border-[var(--green-light)] text-[var(--green-dark)] shadow-sm' : 'bg-white border-border text-text hover:bg-gray-50'}`}
                        >
                          {t.toLowerCase().includes('dataset') && <Database className="w-4 h-4" />}
                          {t}
                        </button>
                      </div>
                      {idx < selectedSteps.length - 1 && (
                        <div
                          onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx + 1); }}
                          className="shrink-0"
                        >
                          <ArrowRight className={`w-5 h-5 transition-colors ${dragOverIdx === idx + 1 ? 'text-[var(--green)]' : 'text-muted'}`} />
                        </div>
                      )}
                    </React.Fragment>
                  ))}

                  {/* Drop zone at end */}
                  {dragIdx !== null && (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOverIdx(selectedSteps.length); }}
                      className={`w-8 h-10 rounded-xl border-2 border-dashed transition-all shrink-0 ${dragOverIdx === selectedSteps.length ? 'border-[var(--green)] bg-[var(--green-pale)]' : 'border-gray-200'}`}
                    />
                  )}

                  {/* + Task button */}
                  <button
                    type="button"
                    onClick={() => setIsAddTaskOpen(true)}
                    className="shrink-0 px-4 py-2.5 rounded-xl border border-dashed border-[var(--green-light)] text-sm font-extrabold text-[var(--green-dark)] hover:bg-[var(--green-pale)] transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Add Task
                  </button>
                </div>
              </div>

              {/* Add Task Modal */}
              <Modal isOpen={isAddTaskOpen} onClose={() => setIsAddTaskOpen(false)} title="Add Task">
                <div className="space-y-3">
                  <p className="text-sm text-muted">Select a task type to add to this pipeline:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { name: 'choose dataset', icon: Database, desc: 'Select dataset version' },
                      { name: 'training data',  icon: Play,     desc: 'Train model on dataset' },
                      { name: 'testing data',   icon: CheckCircle, desc: 'Validate model performance' },
                      { name: 'convert class',  icon: ArrowRight,  desc: 'Remap / merge class names' },
                      { name: 'preprocessing',  icon: ArrowRight,  desc: 'Preprocess data' },
                    ].map(({ name, icon: Icon, desc }) => (
                      <button
                        key={name}
                        type="button"
                        onClick={async () => {
                          const steps = [...selectedSteps, name];
                          await updatePipeline.mutateAsync({ id: selectedPipeline.id, config: { steps } } as any);
                          setSelectedTaskIndex(steps.length - 1);
                          setIsAddTaskOpen(false);
                        }}
                        className="flex flex-col items-start gap-2 p-4 rounded-xl border border-border hover:border-[var(--green-light)] hover:bg-[var(--green-pale)] transition-all text-left group"
                      >
                        <Icon className="w-5 h-5 text-muted group-hover:text-[var(--green)]" />
                        <div>
                          <div className="font-bold text-sm capitalize">{name}</div>
                          <div className="text-[10px] text-muted">{desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-border">
                    <p className="text-[10px] text-muted mb-2 font-bold uppercase tracking-wider">Custom task</p>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const input = (e.currentTarget.elements.namedItem('customTask') as HTMLInputElement).value.trim();
                        if (!input) return;
                        const steps = [...selectedSteps, input];
                        await updatePipeline.mutateAsync({ id: selectedPipeline.id, config: { steps } } as any);
                        setSelectedTaskIndex(steps.length - 1);
                        setIsAddTaskOpen(false);
                      }}
                      className="flex gap-2"
                    >
                      <input name="customTask" type="text" placeholder="Task name..." className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--green-light)]" />
                      <button type="submit" className="px-4 py-2 bg-[var(--green)] text-white rounded-lg text-sm font-bold hover:bg-[var(--green-dark)] transition-colors">Add</button>
                    </form>
                  </div>
                </div>
              </Modal>

              {/* Tabs */}
              <div className="flex-1 flex flex-col min-h-0 bg-gray-50/50 p-6 pt-2">
                <div className="flex items-end gap-1 px-4">
                  {(['config', 'logs'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveDetailTab(tab)}
                      className={`px-8 py-3 text-sm font-bold rounded-t-2xl transition-all relative z-10 -mb-[1px] capitalize ${activeDetailTab === tab ? 'bg-white border-t border-x border-border text-[var(--green-dark)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]' : 'bg-gray-200/50 text-muted hover:text-text border-t border-x border-transparent translate-y-1'}`}
                    >
                      {tab === 'config' ? 'Configuration' : 'Logs'}
                    </button>
                  ))}
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col bg-white rounded-2xl border border-border shadow-sm overflow-hidden relative z-0">
                  <div className="flex-1 overflow-y-auto p-8">
                    {activeDetailTab === 'config' ? (
                      activeTaskName.toLowerCase().includes('training') ? (
                        <TrainingTaskForm
                          pipelineId={selectedPipeline.id}
                          config={{
                            // Spread full task config first (has all saved fields after save)
                            // Fall back to pipeline.config for legacy data that was saved before per-task config
                            ...(selectedPipeline.config || {}),
                            ...(activeTask?.config || {}),
                          }}
                          onSave={async (next) => {
                            if (activeTask) {
                              // Save training params to the task's own config — keeps pipeline.config clean
                              await updatePipelineTask.mutateAsync({ id: activeTask.id, config: next });
                            } else {
                              // Fallback: no task record yet, save to pipeline config preserving steps
                              await updatePipeline.mutateAsync({ id: selectedPipeline.id, config: { ...selectedPipeline.config, ...next, steps: selectedSteps } } as any);
                            }
                          }}
                          onDelete={async () => {
                            if (!window.confirm('Delete this task?')) return;
                            const next = selectedSteps.filter((_, i) => i !== selectedTaskIndex);
                            await updatePipeline.mutateAsync({ id: selectedPipeline.id, config: { steps: next } } as any);
                            setSelectedTaskIndex((cur) => Math.max(0, Math.min(cur, next.length - 1)));
                          }}
                        />
                      ) : activeTaskName.toLowerCase().includes('dataset') ? (
                        <div className="space-y-8 max-w-3xl mx-auto">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-muted uppercase tracking-wider ml-1">Dataset</label>
                              <select
                                value={selectedDatasetId || selectedPipeline.dataset_version?.dataset_id || ''}
                                onChange={(e) => { setSelectedDatasetId(Number(e.target.value)); setSelectedDatasetVersionId(null); }}
                                className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm font-bold focus:ring-2 focus:ring-[var(--green-light)] focus:outline-none transition-all shadow-sm"
                              >
                                <option value="">Select Dataset</option>
                                {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-muted uppercase tracking-wider ml-1">Version</label>
                              <select
                                value={selectedDatasetVersionId || selectedPipeline.dataset_version_id || ''}
                                onChange={(e) => setSelectedDatasetVersionId(Number(e.target.value))}
                                disabled={!selectedDatasetId && !selectedPipeline.dataset_version?.dataset_id}
                                className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm font-bold focus:ring-2 focus:ring-[var(--green-light)] focus:outline-none disabled:bg-gray-50 disabled:text-muted transition-all shadow-sm"
                              >
                                <option value="">Select Version</option>
                                {datasetVersions.map((v) => <option key={v.id} value={v.id}>{v.version_name}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
                            <button
                              type="button"
                              onClick={async () => {
                                const versionId = selectedDatasetVersionId || selectedPipeline.dataset_version_id;
                                if (!versionId) { alert('Please select a dataset version'); return; }
                                // Save dataset_version_id to the task's own config
                                if (activeTask) {
                                  await updatePipelineTask.mutateAsync({ id: activeTask.id, config: { ...activeTask.config, dataset_version_id: versionId } });
                                }
                                // Also update the pipeline FK so training_service can find it
                                await updatePipeline.mutateAsync({ id: selectedPipeline.id, dataset_version_id: versionId } as any);
                              }}
                              className="inline-flex items-center justify-center px-8 py-2.5 bg-[var(--green)] text-white rounded-lg hover:bg-[var(--green-dark)] transition-all shadow-sm font-bold text-sm min-w-[100px]"
                            >
                              Save
                            </button>
                            <button type="button" onClick={() => runPipeline.mutate(selectedPipeline.id)} disabled={runPipeline.isPending} className="inline-flex items-center justify-center px-8 py-2.5 bg-[var(--blue)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm font-bold text-sm min-w-[100px]">
                              {runPipeline.isPending ? 'Running...' : 'Run'}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!window.confirm('Delete this task?')) return;
                                const next = selectedSteps.filter((_, i) => i !== selectedTaskIndex);
                                await updatePipeline.mutateAsync({ id: selectedPipeline.id, config: { steps: next } } as any);
                                setSelectedTaskIndex((cur) => Math.max(0, Math.min(cur, next.length - 1)));
                              }}
                              className="inline-flex items-center justify-center px-8 py-2.5 border border-red/20 text-red bg-red-pale rounded-lg hover:bg-red/10 transition-all shadow-sm font-bold text-sm min-w-[100px]"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ) : activeTaskName.toLowerCase().includes('convert') ? (
                        <ConvertClassTaskForm
                          pipelineId={selectedPipeline.id}
                          taskId={activeTask?.id}
                          config={activeTask?.config || {}}
                          sourceLabels={sourceLabels}
                          onSave={async (next) => {
                            if (activeTask) {
                              await updatePipelineTask.mutateAsync({ id: activeTask.id, config: next });
                            }
                          }}
                          onDelete={async () => {
                            if (!window.confirm('Delete this task?')) return;
                            const next = selectedSteps.filter((_, i) => i !== selectedTaskIndex);
                            await updatePipeline.mutateAsync({ id: selectedPipeline.id, config: { steps: next } } as any);
                            setSelectedTaskIndex((cur) => Math.max(0, Math.min(cur, next.length - 1)));
                          }}
                        />
                      ) : (
                        <div className="space-y-6">
                          <div className="bg-gray-50 border border-border rounded-2xl p-6">
                            <p className="text-sm text-muted italic mb-4 text-center">No configuration UI for this task yet.</p>
                            <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                              <button type="button" onClick={() => runPipeline.mutate(selectedPipeline.id)} disabled={runPipeline.isPending} className="inline-flex items-center justify-center px-6 py-2 bg-[var(--blue)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm font-bold text-sm min-w-[80px]">
                                {runPipeline.isPending ? 'Running...' : 'Run'}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!window.confirm('Delete this task?')) return;
                                  const next = selectedSteps.filter((_, i) => i !== selectedTaskIndex);
                                  await updatePipeline.mutateAsync({ id: selectedPipeline.id, config: { steps: next } } as any);
                                  setSelectedTaskIndex((cur) => Math.max(0, Math.min(cur, next.length - 1)));
                                }}
                                className="inline-flex items-center justify-center px-6 py-2 border border-red/20 text-red bg-red-pale rounded-lg hover:bg-red/10 transition-all shadow-sm font-bold text-sm min-w-[80px]"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="space-y-4">
                        {/* Cancel button — shown when pipeline is running/pending */}
                        {(selectedPipeline.status === 'running' || selectedPipeline.status === 'pending') && (
                          <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                              <span className="text-sm font-bold text-amber-800">
                                Pipeline is {selectedPipeline.status}...
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('Stop this pipeline? Training progress will be lost.')) {
                                  cancelPipeline.mutate(selectedPipeline.id);
                                }
                              }}
                              disabled={cancelPipeline.isPending}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-red-pale border border-red/20 text-red rounded-xl text-sm font-bold hover:bg-red/10 disabled:opacity-50 transition-all"
                            >
                              <StopCircle className="w-4 h-4" />
                              {cancelPipeline.isPending ? 'Stopping...' : 'Stop Pipeline'}
                            </button>
                          </div>
                        )}
                        <div className="bg-gray-900 rounded-xl p-6 font-mono text-[11px] leading-relaxed text-gray-300 overflow-y-auto custom-scrollbar whitespace-pre-wrap shadow-inner border border-white/5 max-h-[500px]">
                          {selectedPipeline.log || '> No logs available for this pipeline yet.'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const PipelineCard: React.FC<{
  pipeline: Pipeline;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onCancel: () => void;
  detailTo: string;
  compact?: boolean;
  active?: boolean;
}> = ({ pipeline, onEdit, onDelete, onCancel, detailTo, compact, active }) => {
  if (compact) {
    return (
      <Link to={detailTo} className={`block w-full text-left bg-surface border rounded-lg p-4 hover:shadow-md transition-shadow ${active ? 'border-[var(--green-light)] ring-2 ring-green/10' : 'border-border'}`} title={pipeline.name || `Pipeline #${pipeline.id}`}>
        <h3 className="font-semibold text-text text-base truncate">{pipeline.name || `Pipeline #${pipeline.id}`}</h3>
      </Link>
    );
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'training': return 'bg-blue-pale text-blue';
      case 'inference': return 'bg-green-pale text-green';
      case 'testing': return 'bg-amber-pale text-amber';
      case 'validation': return 'bg-purple-pale text-purple';
      default: return 'bg-gray-100 text-muted';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running': return <Play className="w-4 h-4 text-amber" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red" />;
      case 'pending': return <Pause className="w-4 h-4 text-muted" />;
      default: return <Workflow className="w-4 h-4 text-muted" />;
    }
  };

  const formatDuration = (started?: string, completed?: string) => {
    if (!started) return 'Not started';
    if (!completed) return 'Running...';
    const duration = Math.floor((new Date(completed).getTime() - new Date(started).getTime()) / 1000);
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
  };

  const steps: string[] = pipeline.config?.steps || [];

  return (
    <div className={`bg-surface border rounded-lg p-4 hover:shadow-md transition-shadow group relative ${active ? 'border-[var(--green-light)] ring-2 ring-green/10' : 'border-border'}`}>
      <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {(pipeline.status === 'running' || pipeline.status === 'pending') && (
          <button
            onClick={(e) => { e.stopPropagation(); if (window.confirm('Stop this pipeline?')) onCancel(); }}
            className="p-1.5 text-muted hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
            title="Stop pipeline"
          >
            <StopCircle className="w-4 h-4" />
          </button>
        )}
        <button onClick={onEdit} className="p-1.5 text-muted hover:text-blue hover:bg-blue-pale rounded-md transition-colors" title="Edit pipeline"><Edit2 className="w-4 h-4" /></button>
        <button onClick={onDelete} className="p-1.5 text-muted hover:text-red hover:bg-red-pale rounded-md transition-colors" title="Delete pipeline"><Trash2 className="w-4 h-4" /></button>
      </div>

      <div className="flex items-center justify-between mb-4 pr-16">
        <div className="flex items-center gap-4">
          {getStatusIcon(pipeline.status)}
          <h3 className="font-semibold text-text text-base">{pipeline.name || `Pipeline #${pipeline.id}`}</h3>
          <span className="text-sm text-muted">{formatDate(pipeline.created_at)}</span>
          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getTypeColor(pipeline.type)} capitalize`}>{pipeline.type}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize ${pipeline.status === 'completed' ? 'bg-green-pale text-green-dark' : pipeline.status === 'running' ? 'bg-amber-pale text-amber' : pipeline.status === 'pending' ? 'bg-blue-pale text-blue' : pipeline.status === 'failed' ? 'bg-red-pale text-red' : 'bg-gray-100 text-muted'}`}>{pipeline.status}</span>
          <Link to={detailTo} className="text-green hover:text-green-dark text-sm font-medium">View Details →</Link>
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-2">
        {steps.length > 0 ? (
          steps.map((step, index) => (
            <React.Fragment key={index}>
              <div className="flex items-center justify-center px-3 py-1.5 bg-gray-50 border border-border rounded-md text-sm font-medium text-text">{step}</div>
              {index < steps.length - 1 && <ArrowRight className="w-4 h-4 text-muted" />}
            </React.Fragment>
          ))
        ) : (
          <span className="text-sm text-muted italic">No tasks defined</span>
        )}
      </div>
    </div>
  );
};

export default PipelineList;
