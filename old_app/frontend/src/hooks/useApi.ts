import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { Dataset, Model, Pipeline, ModelArchitectureInfo, ModelVersion, ModelVersionData, DatasetItemDetail, DatasetVersion, PaginatedDatasetVersionData, PipelineTask, Task, DatasetTask } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Ensure all requests use trailing slash to avoid 307 redirects
// (FastAPI redirects /path → /path/ which breaks POST/PUT methods)
api.interceptors.request.use((config) => {
  if (config.url && !config.url.includes('?') && !config.url.endsWith('/')) {
    config.url = config.url + '/';
  }
  return config;
});

// API hooks
export const useDatasets = () => {
  return useQuery({
    queryKey: ['datasets'],
    queryFn: async (): Promise<Dataset[]> => {
      const response = await api.get('/datasets');
      return response.data;
    },
    staleTime: 30_000, // 30 seconds
  });
};

export const useDataset = (id: number) => {
  return useQuery({
    queryKey: ['datasets', id],
    queryFn: async (): Promise<Dataset> => {
      const response = await api.get(`/datasets/${id}`);
      return response.data;
    },
    enabled: !!id,
    staleTime: 30_000,
  });
};

export const useDatasetVersions = (datasetId: number) => {
  return useQuery({
    queryKey: ['datasets', datasetId, 'versions'],
    queryFn: async (): Promise<DatasetVersion[]> => {
      const response = await api.get(`/datasets/${datasetId}/versions`);
      return response.data;
    },
    enabled: !!datasetId,
    staleTime: 30_000,
  });
};

export const useDatasetVersionData = (
  versionId: number,
  page: number = 1,
  size: number = 20,
  includeAnnotations: boolean = false
) => {
  return useQuery({
    queryKey: ['dataset-versions', versionId, 'data', page, size, includeAnnotations],
    queryFn: async (): Promise<PaginatedDatasetVersionData> => {
      const response = await api.get(
        `/datasets/versions/${versionId}/data?page=${page}&size=${size}&include_annotations=${includeAnnotations ? 'true' : 'false'}`
      );
      return response.data;
    },
    enabled: !!versionId,
  });
};

export const useVersionLabels = (versionId: number) => {
  return useQuery({
    queryKey: ['dataset-versions', versionId, 'labels'],
    queryFn: async (): Promise<string[]> => {
      const response = await api.get(`/datasets/versions/${versionId}/unique-labels`);
      return response.data;
    },
    enabled: !!versionId,
  });
};

export const useVersionTasks = (versionId: number) => {
  return useQuery({
    queryKey: ['dataset-versions', versionId, 'tasks'],
    queryFn: async (): Promise<DatasetTask[]> => {
      const response = await api.get(`/datasets/versions/${versionId}/tasks`);
      return response.data;
    },
    enabled: !!versionId,
  });
};

export const useDatasetItem = (itemId: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['dataset-items', itemId],
    queryFn: async (): Promise<DatasetItemDetail> => {
      const response = await api.get(`/datasets/items/${itemId}`);
      return response.data;
    },
    enabled: enabled && !!itemId,
  });
};

export const useUpdateDatasetItem = (versionId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, annotations }: { id: number; annotations: any[] }) => {
      const response = await api.put(`/datasets/items/${id}`, { annotations });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset-versions', versionId, 'data'] });
      queryClient.invalidateQueries({ queryKey: ['dataset-versions', versionId, 'labels'] });
      queryClient.invalidateQueries({ queryKey: ['dataset-items'] });
    },
    onError: (error: any) => {
      console.error('Failed to update dataset item annotations:', error?.response?.data?.detail || error.message);
    },
  });
};

export const useModelArchitectures = () => {
  return useQuery({
    queryKey: ['configs', 'model-architectures'],
    queryFn: async (): Promise<ModelArchitectureInfo[]> => {
      const response = await api.get('/configs/model-architectures');
      return response.data;
    },
  });
};

export const useCreateDatasetVersion = (datasetId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (version: Partial<DatasetVersion>) => {
      const response = await api.post(`/datasets/${datasetId}/versions`, version);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets', datasetId, 'versions'] });
    },
  });
};

export const useUpdateDatasetVersion = (datasetId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...version }: Partial<DatasetVersion> & { id: number }) => {
      const response = await api.put(`/datasets/versions/${id}`, version);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets', datasetId, 'versions'] });
    },
  });
};

export const useDeleteDatasetVersion = (datasetId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/datasets/versions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets', datasetId, 'versions'] });
    },
  });
};

export const useUploadDatasetFile = (versionId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post(`/datasets/versions/${versionId}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset-versions', versionId, 'data'] });
    },
    onError: (error: any) => {
      console.error('Failed to upload file:', error?.response?.data?.detail || error.message);
    },
  });
};

export const useDeleteDatasetItems = (versionId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemIds: number[]) => {
      await api.post(`/datasets/items/batch-delete`, { item_ids: itemIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset-versions', versionId, 'data'] });
    },
    onError: (error: any) => {
      console.error('Failed to delete dataset items:', error?.response?.data?.detail || error.message);
    },
  });
};

export const useModels = (task?: string) => {
  return useQuery({
    queryKey: ['models', task],
    queryFn: async (): Promise<Model[]> => {
      const response = await api.get('/models', { params: task ? { task } : {} });
      return response.data;
    },
  });
};

export const useModel = (id: number) => {
  return useQuery({
    queryKey: ['models', id],
    queryFn: async (): Promise<Model> => {
      const response = await api.get(`/models/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useModelVersions = (modelId: number) => {
  return useQuery({
    queryKey: ['models', modelId, 'versions'],
    queryFn: async (): Promise<ModelVersion[]> => {
      const response = await api.get(`/models/${modelId}/versions`);
      return response.data;
    },
    enabled: !!modelId,
  });
};

export const useModelVersionData = (versionId: number) => {
  return useQuery({
    queryKey: ['versions', versionId, 'data'],
    queryFn: async (): Promise<ModelVersionData[]> => {
      const response = await api.get(`/models/versions/${versionId}/data`);
      return response.data;
    },
    enabled: !!versionId,
  });
};

export const useCreateModelVersion = (modelId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (version: Partial<ModelVersion>) => {
      const response = await api.post(`/models/${modelId}/versions`, version);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models', modelId, 'versions'] });
    },
  });
};

export const useUpdateModelVersion = (modelId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...version }: Partial<ModelVersion> & { id: number }) => {
      const response = await api.put(`/models/versions/${id}`, version);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models', modelId, 'versions'] });
    },
  });
};

export const useDeleteModelVersion = (modelId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/models/versions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models', modelId, 'versions'] });
    },
  });
};

export const usePipelines = () => {
  return useQuery({
    queryKey: ['pipelines'],
    queryFn: async (): Promise<Pipeline[]> => {
      const response = await api.get('/pipelines');
      return response.data;
    },
  });
};

export const useTasks = () => {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async (): Promise<Task[]> => {
      const response = await api.get('/configs/tasks');
      return response.data;
    },
  });
};

export const useCreateDataset = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dataset: Partial<Dataset>) => {
      const response = await api.post('/datasets', dataset);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
    },
  });
};

export const useUpdateDataset = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...dataset }: Partial<Dataset> & { id: number }) => {
      const response = await api.put(`/datasets/${id}`, dataset);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
    },
  });
};

export const useDeleteDataset = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/datasets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
    },
    onError: (error: any) => {
      console.error('Failed to delete dataset:', error?.response?.data?.detail || error.message);
    },
  });
};

export const useCreateModel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (model: Partial<Model>) => {
      const response = await api.post('/models', model);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });
};

export const useUpdateModel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...model }: Partial<Model> & { id: number }) => {
      const response = await api.put(`/models/${id}`, model);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });
};

export const useDeleteModel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/models/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
    onError: (error: any) => {
      console.error('Failed to delete model:', error?.response?.data?.detail || error.message);
    },
  });
};

export const useCreatePipeline = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pipeline: Partial<Pipeline>) => {
      const response = await api.post('/pipelines', pipeline);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    },
  });
};

export const useUpdatePipeline = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...pipeline }: Partial<Pipeline> & { id: number }) => {
      const response = await api.put(`/pipelines/${id}`, pipeline);
      return response.data;
    },
    onSuccess: (data: Pipeline) => {
      // Update the pipeline directly in the list cache — no refetch needed
      queryClient.setQueryData<Pipeline[]>(['pipelines'], (old) =>
        old ? old.map((p) => (p.id === data.id ? data : p)) : [data]
      );
    },
  });
};

export const useRunPipeline = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await api.post(`/pipelines/${id}/run`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      queryClient.invalidateQueries({ queryKey: ['pipelines', data.id] });
    },
  });
};

export const useCancelPipeline = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await api.post(`/pipelines/${id}/cancel`);
      return response.data;
    },
    onSuccess: (data: Pipeline) => {
      queryClient.setQueryData<Pipeline[]>(['pipelines'], (old) =>
        old ? old.map((p) => (p.id === data.id ? data : p)) : [data]
      );
    },
    onError: (error: any) => {
      console.error('Failed to cancel pipeline:', error?.response?.data?.detail || error.message);
    },
  });
};

export const useCancelPipelineTask = (pipelineId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: number) => {
      const response = await api.post(`/pipelines/${pipelineId}/tasks/${taskId}/cancel`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines', pipelineId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    },
    onError: (error: any) => {
      console.error('Failed to cancel task:', error?.response?.data?.detail || error.message);
    },
  });
};

export const useDeletePipeline = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/pipelines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    },
    onError: (error: any) => {
      console.error('Failed to delete pipeline:', error?.response?.data?.detail || error.message);
    },
  });
};

// Task hooks
export const usePipelineTasks = (pipelineId: number) => {
  return useQuery({
    queryKey: ['pipelines', pipelineId, 'tasks'],
    queryFn: async (): Promise<PipelineTask[]> => {
      const response = await api.get(`/pipelines/${pipelineId}/tasks`);
      return response.data;
    },
    enabled: !!pipelineId,
  });
};

export const useCreatePipelineTask = (pipelineId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: Partial<PipelineTask>) => {
      const response = await api.post(`/pipelines/${pipelineId}/tasks`, task);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines', pipelineId, 'tasks'] });
    },
  });
};

export const useUpdatePipelineTask = (pipelineId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...task }: Partial<PipelineTask> & { id: number }) => {
      const response = await api.put(`/pipelines/${pipelineId}/tasks/${id}`, task);
      return response.data;
    },
    onSuccess: (data: PipelineTask) => {
      // Update the task in cache immediately — no refetch needed, no flash to defaults
      queryClient.setQueryData<PipelineTask[]>(
        ['pipelines', pipelineId, 'tasks'],
        (old) => old ? old.map((t) => (t.id === data.id ? data : t)) : [data]
      );
    },
  });
};

export const useRunPipelineTask = (pipelineId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: number) => {
      const response = await api.post(`/pipelines/${pipelineId}/tasks/${taskId}/run`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines', pipelineId, 'tasks'] });
    },
  });
};

export const useUploadModelFile = (modelId: number, versionId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post(`/models/${modelId}/versions/${versionId}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models', modelId, 'versions'] });
      queryClient.invalidateQueries({ queryKey: ['model-versions', versionId] });
    },
  });
};

export const useModelInference = (modelId: number, versionId: number) => {
  return useMutation({
    mutationFn: async ({ file, conf = 0.3 }: { file: File; conf?: number }) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post(
        `/models/${modelId}/versions/${versionId}/inference?conf=${conf}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return response.data;
    },
  });
};

export const useModelAutoLabel = (versionId: number, itemId: number) => {
  return useMutation({
    mutationFn: async (conf: number = 0.3) => {
      const response = await api.post(`/models/versions/${versionId}/auto-label/${itemId}?conf=${conf}`);
      return response.data;
    },
  });
};

// Utility functions
export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'active':
      return 'text-green';
    case 'running':
    case 'pending':
      return 'text-amber';
    case 'failed':
    case 'cancelled':
      return 'text-red';
    default:
      return 'text-muted';
  }
};

export const getStatusBadge = (status: string) => {
  const baseClasses = 'px-2 py-0.5 text-[10px] font-bold rounded-full border';
  switch (status.toLowerCase()) {
    case 'completed':
      return `${baseClasses} bg-green-pale border-green/20 text-green-dark`;
    case 'running':
      return `${baseClasses} bg-amber-pale border-amber/20 text-amber`;
    case 'pending':
      return `${baseClasses} bg-blue-pale border-blue/20 text-blue`;
    case 'failed':
      return `${baseClasses} bg-red-pale border-red/20 text-red`;
    case 'cancelled':
      return `${baseClasses} bg-gray-100 border-gray-200 text-muted`;
    default:
      return `${baseClasses} bg-gray-100 border-gray-200 text-muted`;
  }
};
