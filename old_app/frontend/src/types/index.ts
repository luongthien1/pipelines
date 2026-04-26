// API Response Types
export interface Dataset {
  id: number;
  name: string;
  description?: string;
  task: string;
  created_at: string;
  updated_at: string;
  versions_count?: number;
}

export interface DatasetVersion {
  id: number;
  dataset_id: number;
  version_name: string;
  data_source: string;
  data_info: string;
  preprocessing_steps: string;
  data_purpose: string;
  train_val_test_size: string;
  annotations?: Record<string, any>;
  processing_config?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DatasetVersionData {
  id: number;
  version_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  url: string;
  preview_url?: string;
  thumbnail_url?: string;
  annotations?: Array<{ label?: string; bbox?: number[] }>;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface PaginatedDatasetVersionData {
  items: DatasetVersionData[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface DatasetItemDetail {
  id: number;
  version_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  url: string;
  preview_url?: string;
  annotations?: Array<{ label?: string; bbox?: number[] }>;
}

export interface Model {
  id: number;
  name: string;
  description?: string;
  task: string;
  owner: string;
  collaborators: string;
  created_at: string;
  updated_at: string;
  versions_count?: number;
}



export interface BaseModelInfo {
  id: string;
  label: string;
  architecture: string;
  version: number;
}

export interface ModelArchitectureInfo {
  id: string;
  name: string;
  versions: number[];
  base_models: BaseModelInfo[];
}

export interface ModelVersion {
  id: number;
  model_id: number;
  version_name: string;
  stage: string;
  status_note: string;
  folder_path: string;
  base_model: string;
  size: string;
  documentation_link?: string;
  training_results?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ModelVersionData {
  id: number;
  version_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  url: string;
  preview_url?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface Task {
  id: string;
  name: string;
}

export interface DatasetTask {
  id: number;
  version_id: number;
  name: string;
  task_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config: Record<string, any>;
  order_idx: number;
  created_at: string;
  updated_at?: string;
  started_at?: string;
  completed_at?: string;
}

export interface PipelineTask {
  id: number;
  pipeline_id: number;
  task_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config: Record<string, any>;
  input_data: Record<string, any>;
  output_data: Record<string, any>;
  previous_task_id?: number;
  log?: string;
  created_at: string;
  updated_at?: string;
  started_at?: string;
  completed_at?: string;
}

export interface Pipeline {
  id: number;
  name?: string;
  type: 'training' | 'inference' | 'testing' | 'validation';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  base_model?: string;
  repo_link?: string;
  dataset_version_id?: number;
  dataset_version?: DatasetVersion & { dataset_id: number };
  config?: Record<string, any>;
  tasks?: PipelineTask[];
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  metrics?: Record<string, any>;
  log?: string;
}

// API Response wrappers
export interface ApiResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface SingleApiResponse<T> {
  data: T;
}

// Form types
export interface CreateDatasetForm {
  name: string;
  description?: string;
  task: string;
}

export interface CreateModelForm {
  name: string;
  description?: string;
  task: string;
  owner: string;
  collaborators?: string;
}

export interface CreatePipelineForm {
  name?: string;
  type: Pipeline['type'];
  base_model?: string;
  repo_link?: string;
  dataset_version_id?: number;
  model_version_id?: number;
}
