// ── Shared annotation types ────────────────────────────────────────────────

export type InteractionMode = 'draw' | 'edit' | 'nav';

export interface BBoxAnnotation {
  type: 'bbox';
  label?: string;
  bbox: number[];        // [x, y, w, h] pixel coords
  confidence?: number;
}

export interface PolygonAnnotation {
  type: 'polygon';
  label?: string;
  points: number[][];    // [[x,y], [x,y], ...] pixel coords
  confidence?: number;
}

// Union — a single annotation can be either type
export type Annotation = BBoxAnnotation | PolygonAnnotation;

// Legacy format used by the backend (flat object, no `type` field)
export interface LegacyAnnotation {
  label?: string;
  bbox?: number[];
  points?: number[][];
  confidence?: number;
}

export function toLegacy(ann: Annotation): LegacyAnnotation {
  if (ann.type === 'bbox') {
    return { label: ann.label, bbox: ann.bbox, confidence: ann.confidence };
  }
  return { label: ann.label, points: ann.points, confidence: ann.confidence };
}

export function fromLegacy(ann: LegacyAnnotation): Annotation {
  if (ann.points && ann.points.length > 0) {
    return { type: 'polygon', label: ann.label, points: ann.points, confidence: ann.confidence };
  }
  return { type: 'bbox', label: ann.label, bbox: ann.bbox || [0, 0, 0, 0], confidence: ann.confidence };
}

// ── Shared props for all labeler components ────────────────────────────────

export interface LabelerProps {
  currentId: number;
  imageUrl: string;
  annotations: LegacyAnnotation[];
  onSave: (annotations: LegacyAnnotation[]) => Promise<void>;
  onCancel: () => void;
  labels: string[];
  suggestedLabels?: string[];
  items: any[];
  onSelectItem: (id: number) => void;
  onLoadMore?: () => void;
  datasetTask: string;
  isEmpty?: boolean;
  onToggleEmpty?: (isEmpty: boolean) => Promise<void>;
}
