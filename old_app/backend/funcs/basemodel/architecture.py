from typing import Dict, List


def get_model_architectures() -> List[Dict]:
    return [
        {
            "id": "yolo",
            "name": "YOLO",
            "versions": [11, 12, 26],
            "base_models": [
                {"id": "yolo11", "label": "YOLO11", "architecture": "YOLO", "version": 11},
                {"id": "yolo12", "label": "YOLO12", "architecture": "YOLO", "version": 12},
                {"id": "yolo26", "label": "YOLO26", "architecture": "YOLO", "version": 26},
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

