// Dummy schemas to satisfy legacy component imports

export interface Dataset {
  id: string;
  name: string;
  type: string;
  format: string;
  description: string;
  createdAt: string;
  size: string;
  numModels: number;
  items: any[];
}

export interface DataRecord {
  id: string;
  url: string;
}

export interface Project {
    id: string;
    name: string;
    description: string;
    status: string;
    datasetIds: string[];
    modelIds: string[];
    pipeline: any[];
}

export interface PipelineNode {
    id: string;
    type: string;
    data: any;
}
