import React, { useState, useEffect } from 'react';
import { 
  useModel, 
  useModelVersions, 
  useModelVersionData, 
  useCreateModelVersion, 
  useUpdateModelVersion, 
  useDeleteModelVersion,
  useUploadModelFile,
  useModelInference,
  formatDate,
  BACKEND_URL
} from '../hooks/useApi';
import { 
  ChevronLeft,
  ChevronRight,
  Plus, 
  Database, 
  FileText, 
  Layout, 
  History,
  Box,
  Upload,
  Edit,
  Trash2,
  ExternalLink
} from 'lucide-react';
import type { ModelVersion } from '../types';
import Modal from './Modal';
import ModelVersionForm from './ModelVersionForm';

interface ModelDetailProps {
  modelId: number;
  onBack: () => void;
}

const ModelDetail: React.FC<ModelDetailProps> = ({ modelId, onBack }) => {
  const { data: model, isLoading: isModelLoading } = useModel(modelId);
  const { data: versions, isLoading: isVersionsLoading } = useModelVersions(modelId);
  
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'description' | 'explorer' | 'inference'>('description');
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<ModelVersion | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const createVersion = useCreateModelVersion(modelId);
  const updateVersion = useUpdateModelVersion(modelId);
  const deleteVersion = useDeleteModelVersion(modelId);
  const uploadModelFile = useUploadModelFile(modelId, selectedVersionId || 0);
  const runInference = useModelInference(modelId, selectedVersionId || 0);

  const [formValues, setFormValues] = useState({
    stage: 'experimental',
    status_note: '',
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
      stage: 'experimental',
      status_note: '',
    });
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVersion) {
      await updateVersion.mutateAsync({ id: editingVersion.id, ...formValues });
    } else {
      // Auto-generate version name
      const nextVersionNumber = (versions?.length || 0) + 1;
      const autoVersionName = `v${nextVersionNumber}`;

      await createVersion.mutateAsync({ 
        ...formValues, 
        version_name: autoVersionName 
      });
    }
    resetForm();
  };

  const handleEdit = (version: ModelVersion) => {
    setEditingVersion(version);
    setFormValues({
      stage: version.stage,
      status_note: version.status_note,
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

  if (isModelLoading || isVersionsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted">Loading model details...</div>
      </div>
    );
  }

  if (!model) return null;

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
            <h1 className="text-2xl font-bold text-text">{model.name}</h1>
            <p className="text-muted text-sm">{model.task}</p>
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
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tight ${
                          version.stage === 'production' ? 'bg-green text-white' : 'bg-gray-200 text-muted'
                        }`}>
                          {version.stage}
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
                <button
                  onClick={() => setActiveTab('inference')}
                  className={`px-4 py-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
                    activeTab === 'inference'
                      ? 'border-[var(--green)] text-[var(--green-dark)]'
                      : 'border-transparent text-muted hover:text-text'
                  }`}
                >
                  <Box className="w-4 h-4" />
                  Test (Inference)
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {activeTab === 'description' ? (
                  <div className="animate-in space-y-6">
                    <div className="bg-gray-50 p-6 rounded-2xl border border-border">
                      <h4 className="text-xs font-bold text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5" />
                        Model Description
                      </h4>
                      <p className="text-text leading-relaxed">
                        {model.description || 'No description available for this model.'}
                      </p>
                    </div>
                  </div>
                ) : activeTab === 'explorer' ? (
                  <DataExplorer 
                    versionId={selectedVersion.id} 
                    onUpload={async (file) => {
                      await uploadModelFile.mutateAsync(file);
                    }}
                    isUploading={uploadModelFile.isPending}
                  />
                ) : (
                  <InferenceTester 
                    modelId={modelId}
                    versionId={selectedVersion.id}
                    runInference={runInference}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted">
              <Box className="w-16 h-16 opacity-10 mb-4" />
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
        <ModelVersionForm
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
  onUpload: (file: File) => Promise<void>; 
  isUploading: boolean;
}> = ({ versionId, onUpload, isUploading }) => {
  const { data: files, isLoading } = useModelVersionData(versionId);

  if (isLoading) return <div className="text-muted">Loading data samples...</div>;

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xs font-bold text-muted uppercase tracking-widest">Version Artifacts & Samples</h3>
          <p className="text-[10px] text-muted mt-1 italic">Files including model.onnx are listed here</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted font-medium">{files?.length || 0} items found</span>
          <label className="relative cursor-pointer">
            <input 
              type="file" 
              className="hidden" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
              }}
            />
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed text-xs font-bold transition-all ${
              isUploading
                ? 'bg-gray-50 border-gray-300 text-muted cursor-not-allowed'
                : 'border-[var(--green)] bg-[var(--green-pale)] text-[var(--green-dark)] hover:bg-[var(--green-light)]'
            }`}>
              <Upload className={`w-3.5 h-3.5 ${isUploading ? 'animate-bounce' : ''}`} />
              {isUploading ? 'Uploading...' : 'Upload File'}
            </div>
          </label>
        </div>
      </div>

      {files && files.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {files.map((file) => (
            <div key={file.id} className="group bg-white border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
              <div className="aspect-video bg-gray-100 flex items-center justify-center relative overflow-hidden">
                {file.preview_url ? (
                  <img src={`${BACKEND_URL}${file.preview_url}`} alt={file.file_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <Database className="w-8 h-8 text-gray-300" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button 
                    onClick={() => window.open(`${BACKEND_URL}${file.url}`, '_blank')}
                    className="bg-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform"
                  >
                    <ExternalLink className="w-4 h-4 text-text" />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <div className="font-bold text-xs truncate mb-1" title={file.file_name}>
                  {file.file_name}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted">
                  <span className="uppercase font-bold">{file.file_type}</span>
                  <span>{(file.file_size / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
          <Database className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-muted italic">No data samples or artifacts indexed for this version.</p>
        </div>
      )}
    </div>
  );
};

// Inference Tester Sub-component
const InferenceTester: React.FC<{
  modelId: number;
  versionId: number;
  runInference: any;
}> = ({ runInference }) => {
  const [testImage, setTestImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [confidence, setConfidence] = useState(0.3);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTestImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleRun = async () => {
    if (!testImage) return;
    try {
      const data = await runInference.mutateAsync({ file: testImage, conf: confidence });
      setResult(data);
    } catch (err) {
      console.error(err);
      alert('Inference failed. Make sure model.onnx is uploaded or base model is available.');
    }
  };

  return (
    <div className="animate-in grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
      {/* Input Side */}
      <div className="space-y-4">
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[260px] relative overflow-hidden group">
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="max-h-full object-contain rounded-xl" />
          ) : (
            <div className="text-center">
              <Plus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-sm text-muted font-medium">Select an image to test</p>
            </div>
          )}
          <input
            type="file"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={handleImageSelect}
          />
        </div>

        {/* Confidence slider */}
        <div className="bg-gray-50 border border-border rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Confidence Threshold</span>
            <span className="text-sm font-black text-[var(--green)]">{Math.round(confidence * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.05} max={0.95} step={0.05}
            value={confidence}
            onChange={(e) => { setConfidence(Number(e.target.value)); setResult(null); }}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              accentColor: 'var(--green)',
              background: `linear-gradient(to right, var(--green) 0%, var(--green) ${((confidence - 0.05) / 0.9) * 100}%, #e5e7eb ${((confidence - 0.05) / 0.9) * 100}%, #e5e7eb 100%)`,
              border: '1px solid #d1d5db',
            }}
          />
          <div className="flex justify-between text-[10px] text-muted font-bold">
            <span>5%</span><span>50%</span><span>95%</span>
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={!testImage || runInference.isPending}
          className={`w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm ${
            !testImage || runInference.isPending
              ? 'bg-gray-100 text-muted cursor-not-allowed'
              : 'bg-[var(--green)] text-white hover:bg-[var(--green-dark)] hover:shadow-lg'
          }`}
        >
          {runInference.isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Running Inference...
            </>
          ) : (
            <>
              <Box className="w-4 h-4" />
              Run Inference
            </>
          )}
        </button>
      </div>

      {/* Result Side */}
      <div className="bg-gray-50 border border-border rounded-3xl p-6 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">Inference Results</h4>
          {result && (
            <span className="text-[10px] font-bold bg-green-pale text-green px-2 py-0.5 rounded-full uppercase">
              {result.metadata?.count || 0} Detections
            </span>
          )}
        </div>

        {result ? (
          <div className="flex-1 flex flex-col gap-6 overflow-hidden">
            <div className="flex-1 bg-black rounded-2xl overflow-hidden flex items-center justify-center">
              <img
                src={`data:image/jpeg;base64,${result.image_base64}`}
                alt="Results"
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div className="space-y-2 overflow-y-auto pr-2 max-h-[200px]">
              {result.detections?.map((det: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 bg-white rounded-lg border border-border">
                  <span className="text-xs font-bold text-text capitalize">{det.label || det.class}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    det.confidence >= 0.7 ? 'bg-green-pale text-green-dark' :
                    det.confidence >= 0.4 ? 'bg-amber-50 text-amber-700' :
                    'bg-gray-100 text-muted'
                  }`}>
                    {(det.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted italic text-xs">
            <Layout className="w-12 h-12 opacity-10 mb-4" />
            No results yet. Run inference to see detections.
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelDetail;
