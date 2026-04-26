"""
DEPRECATED: This file is superseded by training_service.py which uses the
current Model/ModelVersion schema and dataset_service.prepare_yolo_dataset().

Do not use this file. It is kept only for reference and will be removed.
"""
# This module previously imported AIModel (which does not exist) and
# prepare_yolo_dataset from processing.py (a diverged duplicate).
# All training logic now lives in training_service.run_training().
