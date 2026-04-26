/**
 * LabelingStudio — Routes to the correct labeler based on datasetTask.
 * Detection/default → LabelingCanvas (direct port of old app).
 * Segmentation → SegmentationLabeler.
 * Classification → ClassificationLabeler.
 */
import React from 'react';
import LabelingCanvas from './LabelingCanvas';
import SegmentationLabeler from './labeling/SegmentationLabeler';
import ClassificationLabeler from './labeling/ClassificationLabeler';
import type { LabelerProps } from './labeling/shared/types';

const SEGMENTATION_TASKS = new Set([
  'semantic_segmentation',
  'instance_segmentation',
  'segmentation',
  'panoptic_segmentation',
  'image_segmentation',
]);

const CLASSIFICATION_TASKS = new Set([
  'image_classification',
  'classification',
  'multi_label_classification',
]);

const LabelingStudio: React.FC<LabelerProps> = (props) => {
  const task = (props.datasetTask || '').toLowerCase().trim().replace(/[\s\-_]+/g, '_');

  if (SEGMENTATION_TASKS.has(task)) {
    return <SegmentationLabeler {...props} />;
  }

  if (CLASSIFICATION_TASKS.has(task)) {
    return <ClassificationLabeler {...props} />;
  }

  // Default: use LabelingCanvas (identical to old app)
  return (
    <LabelingCanvas
      currentId={props.currentId}
      imageUrl={props.imageUrl}
      annotations={props.annotations}
      onSave={props.onSave}
      onCancel={props.onCancel}
      labels={props.labels}
      suggestedLabels={props.suggestedLabels}
      items={props.items}
      onSelectItem={props.onSelectItem}
      onLoadMore={props.onLoadMore}
      datasetTask={props.datasetTask}
      isEmpty={props.isEmpty}
      onToggleEmpty={props.onToggleEmpty}
    />
  );
};

export default LabelingStudio;
