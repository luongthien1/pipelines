import { Pipeline, PipelineDetail, PipelineRun, TaskTypeSchema } from '../types/pipeline';

const BASE_URL = '/api';

// ────────── Task Types ──────────

export async function getTaskTypes(): Promise<TaskTypeSchema[]> {
  const res = await fetch(`${BASE_URL}/task-types/`);
  if (!res.ok) throw new Error('Failed to fetch task types');
  return res.json();
}

export async function getTaskInstanceSchema(taskName: string, config: Record<string, unknown>): Promise<TaskTypeSchema> {
  const res = await fetch(`${BASE_URL}/task-types/${taskName}/schema`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to fetch dynamic schema');
  return res.json();
}


// ────────── Pipeline CRUD ──────────

export async function getPipelines(): Promise<Pipeline[]> {
  const res = await fetch(`${BASE_URL}/pipelines/`);
  if (!res.ok) throw new Error('Failed to fetch pipelines');
  return res.json();
}

export async function getPipeline(id: number): Promise<PipelineDetail> {
  const res = await fetch(`${BASE_URL}/pipelines/${id}`);
  if (!res.ok) throw new Error('Failed to fetch pipeline');
  return res.json();
}

export async function createPipeline(data: { name: string; description?: string }): Promise<Pipeline> {
  const res = await fetch(`${BASE_URL}/pipelines/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create pipeline');
  return res.json();
}

export async function getPipelineRuns(): Promise<PipelineRun[]> {
  const res = await fetch(`${BASE_URL}/runs/`);
  if (!res.ok) throw new Error('Failed to fetch runs');
  return res.json();
}

export async function updatePipeline(id: number, data: { name?: string; description?: string }): Promise<Pipeline> {
  const res = await fetch(`${BASE_URL}/pipelines/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update pipeline');
  return res.json();
}

export async function deletePipeline(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/pipelines/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete pipeline');
}

// ────────── Graph Sync ──────────

export async function syncPipelineGraph(
  pipelineId: number,
  nodes: { id: string; node_type: string; config: Record<string, unknown>; position_x: number; position_y: number }[],
  edges: { id: string; source_node_id: string; target_node_id: string; source_port?: string; target_port?: string }[]
): Promise<PipelineDetail> {
  const res = await fetch(`${BASE_URL}/pipelines/${pipelineId}/graph`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodes, edges }),
  });
  if (!res.ok) throw new Error('Failed to sync graph');
  return res.json();
}

// ────────── Runs ──────────

export async function startPipelineRun(pipelineId: number, priority: number = 0): Promise<PipelineRun> {
  const res = await fetch(`${BASE_URL}/runs/${pipelineId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priority }),
  });
  if (!res.ok) throw new Error('Failed to start run');
  return res.json();
}

export async function cancelPipelineRun(runId: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/runs/${runId}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to cancel run');
}

export async function getRunStatus(runId: number): Promise<PipelineRun> {
  const res = await fetch(`${BASE_URL}/runs/${runId}`);
  if (!res.ok) throw new Error('Failed to fetch run status');
  return res.json();
}

export async function uploadTaskNode(file: File): Promise<{ message: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE_URL}/task-types/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to upload task node');
  }
  return res.json();
}

export async function getTaskFiles(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/task-types/files`);
  if (!res.ok) throw new Error('Failed to fetch task files');
  return res.json();
}

export async function getTaskFile(filename: string): Promise<{ filename: string; content: string }> {
  const res = await fetch(`${BASE_URL}/task-types/files/${filename}`);
  if (!res.ok) throw new Error('Failed to fetch task file content');
  return res.json();
}

export async function saveTaskFile(filename: string, content: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/task-types/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to save task file');
  }
  return res.json();
}

export async function deleteTaskFile(filename: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/task-types/files/${filename}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete task file');
  return res.json();
}
