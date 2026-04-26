import React, { useEffect, useState } from 'react';
import { useDataset, useDatasetVersions, useDatasetVersionData, useDatasetItem, useCreateDatasetVersion, useUpdateDatasetVersion, useDeleteDatasetVersion, useUploadDatasetFile, useDeleteDatasetItems, useVersionTasks, useUpdateDatasetItem, useVersionLabels, formatDate, BACKEND_URL } from '../hooks/useApi';
import LabelingStudio from './LabelingStudio';
import {
  Edit,
  Trash2,
  Plus,
  Layout,
  Database,
  FileText,
  ExternalLink,
  History,
  ChevronRight,
  ChevronLeft,
  Upload,
  CheckSquare,
  Square,
  Trash,
  Tag
} from 'lucide-react';
import type { DatasetVersion } from '../types';
import Modal from './Modal';
import DatasetVersionForm from './DatasetVersionForm';

interface DatasetDetailProps {
  datasetId: number;
  onBack: () => void;
}

const DatasetDetail: React.FC<DatasetDetailProps> = ({ datasetId, onBack }) => {
  const { data: dataset, isLoading: isDatasetLoading } = useDataset(datasetId);
  const { data: versions, isLoading: isVersionsLoading } = useDatasetVersions(datasetId);
  
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'description' | 'explorer'>('description');
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<DatasetVersion | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const createVersion = useCreateDatasetVersion(datasetId);
  const updateVersion = useUpdateDatasetVersion(datasetId);
  const deleteVersion = useDeleteDatasetVersion(datasetId);

  const [formValues, setFormValues] = useState({
    version_name: '',
    data_info: '',
  });

  const selectedVersion = versions?.find(v => v.id === selectedVersionId) || (versions && versions.length > 0 ? versions[0] : null);

  useEffect(() => {
    if (versions && versions.length > 0 && !selectedVersionId) {
      setSelectedVersionId(versions[0].id);
    }
  }, [versions, selectedVersionId]);

  const handleFormChange = (field: string, value: string) => {
    setFormValues(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setIsVersionModalOpen(false);
    setEditingVersion(null);
    setFormValues({
      version_name: '',
      data_info: '',
    });
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVersion) {
      await updateVersion.mutateAsync({ id: editingVersion.id, ...formValues });
    } else {
      // Auto-generate version name if empty
      let versionName = formValues.version_name;
      if (!versionName) {
        const nextVersionNumber = (versions?.length || 0) + 1;
        versionName = `v${nextVersionNumber}`;
      }
      
      await createVersion.mutateAsync({ 
        ...formValues, 
        version_name: versionName 
      });
    }
    resetForm();
  };

  const handleEdit = (version: DatasetVersion) => {
    setEditingVersion(version);
    setFormValues({
      version_name: version.version_name,
      data_info: version.data_info,
    });
    setIsVersionModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this version?')) {
      await deleteVersion.mutateAsync(id);
      if (selectedVersionId === id) {
        setSelectedVersionId(versions?.[0]?.id || null);
      }
    }
  };

  if (isDatasetLoading || isVersionsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted">Loading dataset details...</div>
      </div>
    );
  }

  if (!dataset) return null;

  return (
    <div className="flex flex-col h-full animate-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-border transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-muted" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text">{dataset.name}</h1>
            <p className="text-muted text-sm">{dataset.task}</p>
          </div>
        </div>
        <button
          onClick={() => setIsVersionModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--green)] text-white rounded-lg hover:bg-[var(--green-dark)] transition-all shadow-sm font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          New Version
        </button>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Left Sidebar: Version List */}
        <div className={`${sidebarCollapsed ? 'w-14' : 'w-72'} flex flex-col bg-surface border border-border rounded-2xl overflow-hidden shadow-sm transition-all duration-300 shrink-0`}>
          <div className="p-4 border-b border-border bg-gray-50/50 flex items-center justify-between">
            {!sidebarCollapsed && (
              <h3 className="font-bold text-sm flex items-center gap-2 uppercase tracking-wider text-muted">
                <History className="w-4 h-4" />
                History
              </h3>
            )}
            <div className={`flex items-center gap-2 ${sidebarCollapsed ? 'w-full justify-center' : ''}`}>
              {!sidebarCollapsed && (
                <span className="text-xs bg-white border border-border px-2 py-0.5 rounded-full font-medium">
                  {versions?.length || 0}
                </span>
              )}
              <button
                onClick={() => setSidebarCollapsed(v => !v)}
                className="p-1 rounded-lg hover:bg-white border border-transparent hover:border-border transition-all"
                title={sidebarCollapsed ? 'Expand' : 'Collapse'}
              >
                {sidebarCollapsed ? <ChevronRight className="w-4 h-4 text-muted" /> : <ChevronLeft className="w-4 h-4 text-muted" />}
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {versions && versions.length > 0 ? (
              versions.map((version) => (
                <div
                  key={version.id}
                  onClick={() => setSelectedVersionId(version.id)}
                  title={sidebarCollapsed ? version.version_name : undefined}
                  className={`group p-3 rounded-xl cursor-pointer transition-all relative ${
                    selectedVersionId === version.id
                      ? 'bg-[var(--green-pale)] border border-[var(--green-light)]'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  {sidebarCollapsed ? (
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black mx-auto ${
                      selectedVersionId === version.id ? 'bg-[var(--green)] text-white' : 'bg-gray-200 text-muted'
                    }`}>
                      {version.version_name.replace(/[^0-9]/g, '') || '?'}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-bold text-sm ${selectedVersionId === version.id ? 'text-[var(--green-dark)]' : 'text-text'}`}>
                          {version.version_name}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted font-medium">
                        {formatDate(version.created_at)}
                      </div>
                      <div className="absolute right-2 bottom-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(version); }} className="p-1 hover:text-[var(--green)] transition-colors">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(version.id); }} className="p-1 hover:text-red transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            ) : (
              !sidebarCollapsed && (
                <div className="p-8 text-center text-muted italic text-sm">No versions found</div>
              )
            )}
          </div>
        </div>

        {/* Right Content: Detail View */}
        <div className="flex-1 flex flex-col bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
          {selectedVersion ? (
            <>
              {/* Tabs Header */}
              <div className="flex items-center border-b border-border px-4 bg-gray-50/50">
                <button
                  onClick={() => setActiveTab('description')}
                  className={`px-4 py-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
                    activeTab === 'description'
                      ? 'border-[var(--green)] text-[var(--green-dark)]'
                      : 'border-transparent text-muted hover:text-text'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Description
                </button>
                <button
                  onClick={() => setActiveTab('explorer')}
                  className={`px-4 py-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
                    activeTab === 'explorer'
                      ? 'border-[var(--green)] text-[var(--green-dark)]'
                      : 'border-transparent text-muted hover:text-text'
                  }`}
                >
                  <Layout className="w-4 h-4" />
                  Data Explorer
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {activeTab === 'description' ? (
                  <div className="animate-in">
                    <p className="text-text leading-relaxed bg-gray-50 p-4 rounded-xl border border-border">
                      {selectedVersion.data_info || 'No description available for this version.'}
                    </p>
                  </div>
                ) : (
                  <DataExplorer 
                    versionId={selectedVersion.id} 
                    selectedVersion={selectedVersion} 
                    datasetTask={dataset?.task || ''} 
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted">
              <Database className="w-16 h-16 opacity-10 mb-4" />
              <p>No version selected or available.</p>
              <button
                onClick={() => setIsVersionModalOpen(true)}
                className="mt-4 text-[var(--green)] font-bold hover:underline"
              >
                Create your first version
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Version Form Modal */}
      <Modal
        isOpen={isVersionModalOpen}
        onClose={resetForm}
        title={editingVersion ? 'Edit Version' : 'Create New Version'}
      >
        <DatasetVersionForm
          formValues={formValues}
          handleFormChange={handleFormChange}
          onSubmit={handleCreateOrUpdate}
          onCancel={resetForm}
          isEditing={!!editingVersion}
        />
      </Modal>
    </div>
  );
};

// Data Explorer Sub-component
const DataExplorer: React.FC<{ 
  versionId: number; 
  selectedVersion: DatasetVersion | null;
  datasetTask: string;
}> = ({ versionId, selectedVersion, datasetTask }) => {
  const [page, setPage] = useState(1);
  const [viewerItemId, setViewerItemId] = useState<number | null>(null);
  const [viewerShowAnnotations, setViewerShowAnnotations] = useState(false);
  const [viewerDims, setViewerDims] = useState<{ w: number; h: number } | null>(null);
  const size = 20;
  // Always fetch with annotations so label filter works
  const { data: response, isLoading } = useDatasetVersionData(versionId, page, size, true);
  const { data: viewerItem, isLoading: isViewerLoading } = useDatasetItem(viewerItemId || 0, !!viewerItemId);
  const { data: versionTasks } = useVersionTasks(versionId);
  const { data: suggestedLabels = [] } = useVersionLabels(versionId);
  
  const [isEditingLabels, setIsEditingLabels] = useState(false);
  const updateItemMutation = useUpdateDatasetItem(versionId);

  // Extract labels from tasks
  const labelingTask = versionTasks?.find((t: any) => t.task_type === 'labeling');
  const availableLabels = labelingTask?.config?.labels || selectedVersion?.annotations?.labels || ['Object', 'Palm', 'Health', 'Pest'];

  // ── Label filter state ──────────────────────────────────────────────────
  // null = show all, 'unlabeled' = items with no annotations, string = specific label
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  const toggleFilter = (label: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
    setSelectedIds(new Set());
  };

  const clearFilters = () => { setActiveFilters(new Set()); setSelectedIds(new Set()); };
  
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const deleteItemsMutation = useDeleteDatasetItems(versionId);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [versionId, page]);

  // Reset filter when version changes
  useEffect(() => { setActiveFilters(new Set()); }, [versionId]);

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (!filteredFiles) return;
    if (selectedIds.size === filteredFiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFiles.map(f => f.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.size} items?`)) {
      await deleteItemsMutation.mutateAsync(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  if (isLoading) return <div className="text-muted">Loading data samples...</div>;

  const files = response?.items || [];
  const total = response?.total || 0;
  const pages = response?.pages || 1;

  // Client-side label filter
  const filteredFiles = activeFilters.size === 0
    ? files
    : files.filter(file => {
        const anns = file.annotations || [];
        if (activeFilters.has('__unlabeled__')) {
          if (anns.length === 0) return true;
        }
        const fileLabels = new Set(anns.map((a: any) => a.label).filter(Boolean));
        for (const f of activeFilters) {
          if (f !== '__unlabeled__' && fileLabels.has(f)) return true;
        }
        return false;
      });

  // All labels present in current page (for filter chips)
  const pageLabels = Array.from(new Set(
    files.flatMap(f => (f.annotations || []).map((a: any) => a.label).filter(Boolean))
  )).sort() as string[];

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-xs font-bold text-muted uppercase tracking-widest">Dataset Samples</h3>
          <span className="text-xs text-muted font-medium">
            {activeFilters.size > 0 ? `${filteredFiles.length} / ${total}` : total} items
          </span>
          {filteredFiles.length > 0 && (
            <button
              onClick={selectAll}
              className="text-[10px] font-bold text-[var(--green-dark)] hover:underline uppercase tracking-tight"
            >
              {selectedIds.size === filteredFiles.length ? 'Deselect All' : 'Select All Page'}
            </button>
          )}
        </div>
        <UploadButton versionId={versionId} />
      </div>

      {/* ── Label filter bar ── */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {/* All chip */}
        <button
          onClick={clearFilters}
          className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
            activeFilters.size === 0
              ? 'bg-text text-white border-text'
              : 'bg-white border-border text-muted hover:border-gray-400'
          }`}
        >
          All
        </button>

        {/* Unlabeled chip */}
        <button
          onClick={() => toggleFilter('__unlabeled__')}
          className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
            activeFilters.has('__unlabeled__')
              ? 'bg-gray-700 text-white border-gray-700'
              : 'bg-white border-border text-muted hover:border-gray-400'
          }`}
        >
          Unlabeled
        </button>

        {/* Label chips — from version labels + page labels */}
        {Array.from(new Set([...suggestedLabels, ...pageLabels])).sort().map(label => {
          const active = activeFilters.has(label);
          // Count items on this page with this label
          const count = files.filter(f =>
            (f.annotations || []).some((a: any) => a.label === label)
          ).length;
          return (
            <button
              key={label}
              onClick={() => toggleFilter(label)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
                active
                  ? 'bg-[var(--green)] text-white border-[var(--green)]'
                  : 'bg-white border-border text-muted hover:border-[var(--green-light)] hover:text-[var(--green-dark)]'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-white/20' : 'bg-gray-100'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {/* Clear filter button */}
        {activeFilters.size > 0 && (
          <button
            onClick={clearFilters}
            className="text-[10px] font-bold text-muted hover:text-red transition-colors ml-1"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Batch Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-[var(--green-pale)] border border-[var(--green-light)] rounded-xl p-3 mb-6 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-[var(--green-dark)]">
              {selectedIds.size} items selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-xs font-bold text-muted hover:text-text hover:bg-white/50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteSelected}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-pale border border-red/20 text-red rounded-lg hover:bg-red/10 transition-all shadow-sm font-bold text-xs"
            >
              <Trash className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>
      )}

      {files && files.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            {filteredFiles.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => {
                  setViewerItemId(file.id);
                  setViewerShowAnnotations(false);
                  setViewerDims(null);
                  setIsEditingLabels(false);
                }}
                className={`text-left group bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all relative ${
                  selectedIds.has(file.id) ? 'border-[var(--green)] ring-2 ring-[var(--green)]/10' : 'border-border'
                }`}
              >
                {/* Selection Overlay */}
                <div 
                  onClick={(e) => { e.stopPropagation(); toggleSelect(file.id); }}
                  className={`absolute top-2 left-2 z-10 p-1.5 rounded-lg transition-all ${
                    selectedIds.has(file.id) 
                    ? 'bg-[var(--green)] text-white' 
                    : 'bg-white/80 backdrop-blur-sm text-muted opacity-0 group-hover:opacity-100 hover:bg-white'
                  }`}
                >
                  {selectedIds.has(file.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                </div>
                <div className="aspect-square bg-gray-100 flex items-center justify-center relative overflow-hidden">
                  {file.annotations && file.annotations.length > 0 && (
                    <div className="absolute top-2 right-2 bg-[var(--green)] text-white p-1.5 rounded-lg shadow-[0_2px_10px_rgba(34,197,94,0.3)] z-10" title="Labeled">
                      <Tag className="w-3.5 h-3.5" />
                    </div>
                  )}
                  {file.thumbnail_url ? (
                    <img src={`${BACKEND_URL}${file.thumbnail_url}`} alt={file.file_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : file.preview_url ? (
                    <img src={`${BACKEND_URL}${file.preview_url}`} alt={file.file_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <Database className="w-8 h-8 text-gray-300" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`${BACKEND_URL}${file.url}`, '_blank');
                      }}
                      className="bg-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform"
                    >
                      <ExternalLink className="w-4 h-4 text-text" />
                    </button>
                  </div>
                </div>
                <div className="p-2">
                  <div className="font-bold text-[10px] truncate" title={file.file_name}>
                    {file.file_name}
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-muted mt-1">
                    <span className="uppercase font-bold">{file.file_type}</span>
                    <span>{(file.file_size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Empty state when filter has no results */}
          {filteredFiles.length === 0 && files.length > 0 && (
            <div className="text-center py-16 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <Tag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-muted font-bold">No items match the selected labels</p>
              <button onClick={clearFilters} className="mt-3 text-[var(--green)] text-sm font-bold hover:underline">
                Clear filter
              </button>
            </div>
          )}

          <Modal
            isOpen={!!viewerItemId}
            onClose={() => {
              setViewerItemId(null);
              setViewerShowAnnotations(false);
              setViewerDims(null);
              setIsEditingLabels(false);
            }}
            title={isEditingLabels ? `Labeling Studio: ${selectedVersion?.version_name}` : (viewerItem?.file_name || 'Sample Viewer')}
            size={isEditingLabels ? 'full' : 'md'}
            noPadding={isEditingLabels}
            disableContentScroll={isEditingLabels}
          >
            {isEditingLabels && viewerItem ? (
              <LabelingStudio
                currentId={viewerItemId || 0}
                imageUrl={`${BACKEND_URL}${viewerItem.url}`}
                annotations={viewerItem.annotations || []}
                labels={availableLabels}
                suggestedLabels={suggestedLabels}
                items={files}
                onSelectItem={(id) => setViewerItemId(id)}
                onLoadMore={() => {
                  if (page < pages) setPage(p => p + 1);
                }}
                datasetTask={datasetTask}
                onCancel={() => setIsEditingLabels(false)}
                onSave={async (newAnnots) => {
                  try {
                    await updateItemMutation.mutateAsync({ id: viewerItem.id, annotations: newAnnots });
                  } catch (err) {
                    console.error(err);
                  }
                }}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setViewerShowAnnotations((v) => !v)}
                      className={`px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${
                        viewerShowAnnotations
                          ? 'bg-[var(--green-pale)] border-[var(--green-light)] text-[var(--green-dark)]'
                          : 'bg-white border-border text-muted hover:bg-gray-50'
                      }`}
                      disabled={isViewerLoading || !viewerItem}
                    >
                      {viewerShowAnnotations ? 'Annotations: ON' : 'Annotations: OFF'}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setIsEditingLabels(true)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs font-bold text-muted hover:bg-gray-50 transition-colors"
                      disabled={isViewerLoading || !viewerItem}
                    >
                      <Tag className="w-4 h-4" />
                      Edit Labels
                    </button>
                  </div>

                  {viewerItem && (
                    <button
                      type="button"
                      onClick={() => window.open(`${BACKEND_URL}${viewerItem.url}`, '_blank')}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs font-bold text-muted hover:bg-gray-50 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open
                    </button>
                  )}
                </div>

                <div className="w-full bg-gray-50 border border-border rounded-2xl overflow-hidden">
                  {viewerItem?.preview_url ? (
                    <div className="relative w-full">
                      <img
                        src={`${BACKEND_URL}${viewerItem.preview_url}`}
                        alt={viewerItem.file_name}
                        onLoad={(e) => {
                          const w = e.currentTarget.naturalWidth || 1;
                          const h = e.currentTarget.naturalHeight || 1;
                          setViewerDims({ w, h });
                        }}
                        className="w-full max-h-[70vh] object-contain bg-black"
                      />
                      {viewerShowAnnotations && viewerItem.annotations && viewerItem.annotations.length > 0 && viewerDims && (
                        <svg
                          className="absolute inset-0 pointer-events-none"
                          viewBox={`0 0 ${viewerDims.w} ${viewerDims.h}`}
                          preserveAspectRatio="xMidYMid meet"
                        >
                          {viewerItem.annotations.map((ann, idx) => {
                            const bbox = ann?.bbox || [];
                            const x = bbox[0] ?? 0;
                            const y = bbox[1] ?? 0;
                            const w = bbox[2] ?? 0;
                            const h = bbox[3] ?? 0;
                            const label = ann?.label || '';
                            return (
                              <g key={idx}>
                                <rect x={x} y={y} width={w} height={h} fill="none" stroke="rgba(220, 38, 38, 0.95)" strokeWidth="3" />
                                {label && (
                                  <>
                                    <rect x={x} y={Math.max(0, y - 22)} width={Math.max(40, label.length * 8)} height={22} fill="rgba(220, 38, 38, 0.95)" />
                                    <text x={x + 6} y={Math.max(15, y - 6)} fill="#ffffff" fontSize="14" fontWeight="800">
                                      {label}
                                    </text>
                                  </>
                                )}
                              </g>
                            );
                          })}
                        </svg>
                      )}
                    </div>
                  ) : (
                    <div className="p-10 text-center text-muted">
                      <Database className="w-10 h-10 opacity-30 mx-auto mb-3" />
                      No preview available
                    </div>
                  )}
                </div>

                {viewerItem && (
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span className="font-bold uppercase">{viewerItem.file_type}</span>
                    <span>{(viewerItem.file_size / 1024).toFixed(1)} KB</span>
                  </div>
                )}
              </div>
            )}
          </Modal>

          {/* Pagination Controls */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8 border-t border-border pt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-muted" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text">Page {page}</span>
                <span className="text-sm text-muted">of {pages}</span>
              </div>
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="p-2 rounded-lg border border-border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-muted" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
          <Database className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-muted italic">No data samples indexed for this version.</p>
        </div>
      )}
    </div>
  );
};

// Upload Button Component for Data Explorer
const UploadButton: React.FC<{ versionId: number }> = ({ versionId }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [progress, setProgress] = React.useState({ current: 0, total: 0 });
  
  const uploadMutation = useUploadDatasetFile(versionId);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setProgress({ current: 0, total: files.length });

    try {
      for (let i = 0; i < files.length; i++) {
        setProgress(prev => ({ ...prev, current: i + 1 }));
        await uploadMutation.mutateAsync(files[i]);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Some files failed to upload. Please try again.');
    } finally {
      setIsUploading(false);
      setProgress({ current: 0, total: 0 });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-3">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="image/*"
        className="hidden"
      />
      
      {isUploading && (
        <span className="text-[10px] font-bold text-[var(--green-dark)] animate-pulse">
          Uploading {progress.current}/{progress.total}...
        </span>
      )}

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs font-bold ${
          isUploading
            ? 'bg-gray-50 border-border text-muted cursor-not-allowed'
            : 'bg-white border-[var(--green-light)] text-[var(--green-dark)] hover:bg-[var(--green-pale)] shadow-sm'
        }`}
      >
        <Upload className={`w-3.5 h-3.5 ${isUploading ? 'animate-bounce' : ''}`} />
        {isUploading ? 'Uploading...' : 'Upload Data'}
      </button>
    </div>
  );
};

export default DatasetDetail;
