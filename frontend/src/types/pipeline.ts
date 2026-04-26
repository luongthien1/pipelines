// Types for the Pipeline system

// ────────── Task Type Registry ──────────

export interface SelectOption {
  value: string;
  label: string;
}

export interface PortSchema {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  description: string;
}

export interface ConfigFieldSchema {
  name: string;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'select' | 'textarea';
  default: unknown;
  required: boolean;
  description: string;
  options: SelectOption[];
  placeholder: string;
}

export interface TaskTypeSchema {
  name: string;
  label: string;
  description: string;
  category: string;
  is_dynamic: boolean;
  inputs: PortSchema[];
  outputs: PortSchema[];
  config_fields: ConfigFieldSchema[];
  memory_mb: number;
}

// ────────── Pipeline Types ──────────

export interface Pipeline {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface PipelineNode {
  id: string;
  pipeline_id: number;
  node_type: string;
  config: Record<string, unknown>;
  position_x: number;
  position_y: number;
}

export interface PipelineEdge {
  id: string;
  pipeline_id: number;
  source_node_id: string;
  target_node_id: string;
  source_port?: string;
  target_port?: string;
}

export interface PipelineDetail extends Pipeline {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

export interface NodeRun {
  id: number;
  pipeline_run_id: number;
  node_id: string;
  status: 'waiting' | 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  logs?: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  start_time?: string;
  end_time?: string;
}

export interface PipelineRun {
  id: number;
  pipeline_id: number;
  pipeline_name?: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  priority: number;
  start_time?: string;
  end_time?: string;
  node_runs?: NodeRun[];
}

// NodeType is now a plain string — driven by the registry at runtime
export type NodeType = string;

export const NODE_STATUS_COLORS: Record<string, string> = {
  waiting: '#8c8c8c',
  pending: '#faad14',
  running: '#1677ff',
  success: '#52c41a',
  failed: '#ff4d4f',
  cancelled: '#d9d9d9',
};
