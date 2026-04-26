/**
 * LabelingStudio — entry point that routes to the correct labeler
 * based on `datasetTask`.
 *
 * Supported tasks:
 *   object_detection          → DetectionLabeler  (bounding boxes)
 *   semantic_segmentation     → SegmentationLabeler (polygons)
 *   instance_segmentation     → SegmentationLabeler (polygons)
 *   (anything else)           → DetectionLabeler  (fallback)
 *
 * Adding a new task type:
 *   1. Create frontend/src/components/labeling/MyTaskLabeler.tsx
 *   2. Add a case in the switch below
 */
import React from 'react';
import DetectionLabeler from './labeling/DetectionLabeler';
import SegmentationLabeler from './labeling/SegmentationLabeler';
import type { LabelerProps } from './labeling/shared/types';

const SEGMENTATION_TASKS = new Set([
  'semantic_segmentation',
  'instance_segmentation',
  'segmentation',
  'panoptic_segmentation',
]);

const LabelingStudio: React.FC<LabelerProps> = (props) => {
  const task = (props.datasetTask || '').toLowerCase().replace(/\s+/g, '_');

  if (SEGMENTATION_TASKS.has(task)) {
    return <SegmentationLabeler {...props} />;
  }

  // Default: object detection / bounding box
  return <DetectionLabeler {...props} />;
};

export default LabelingStudio;
