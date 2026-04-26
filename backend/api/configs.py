from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter()

@router.get("/tasks", summary="List all available AI project/task types")
def get_tasks() -> List[Dict[str, str]]:
    """
    Returns a list of high-level AI task types for Datasets and Models.
    Used by the frontend to populate task selection dropdowns.
    """
    return [
        {"id": "image_classification", "name": "Image Classification"},
        {"id": "image_detection", "name": "Image Detection"},
        {"id": "image_segmentation", "name": "Image Segmentation"},
    ]

@router.get("/model-architectures", summary="List supported model architectures")
def get_model_architectures() -> List[Dict[str, Any]]:
    """
    Returns a list of model architectures and their versions.
    Satisfies frontend requests for model configuration options.
    """
    return [
        {
            "id": "yolo",
            "name": "YOLO",
            "versions": [8, 11, 12],
            "base_models": [
                {"id": "yolov8n", "label": "YOLOv8 Nano", "architecture": "YOLO", "version": 8},
                {"id": "yolo11n", "label": "YOLO11 Nano", "architecture": "YOLO", "version": 11},
                {"id": "yolo12n", "label": "YOLO12 Nano", "architecture": "YOLO", "version": 12},
            ],
        },
        {
            "id": "detr",
            "name": "DETR",
            "versions": [1, 2],
            "base_models": [
                {
                    "id": "detr_resnet50",
                    "label": "DETR ResNet-50",
                    "architecture": "DETR",
                    "version": 1,
                    "hf_model": "facebook/detr-resnet-50",
                },
                {
                    "id": "detr_resnet101",
                    "label": "DETR ResNet-101",
                    "architecture": "DETR",
                    "version": 2,
                    "hf_model": "facebook/detr-resnet-101",
                },
            ],
        },
    ]
