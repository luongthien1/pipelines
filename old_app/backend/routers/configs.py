from fastapi import APIRouter
from typing import List, Dict, Any
from ..services.config_service import config_service
from ..services.background_task_manager import task_manager

router = APIRouter()

@router.get("/tasks", response_model=List[Dict[str, str]])
async def get_tasks():
    """
    Returns a list of all available AI tasks.
    """
    return config_service.get_tasks()

@router.get("/model-architectures", response_model=List[Dict[str, Any]])
async def get_model_architectures():
    return config_service.get_model_architectures()

@router.get("/background-tasks")
async def get_background_tasks():
    """
    Returns the current status of all background tasks.
    """
    return task_manager.list_tasks()

@router.get("/background-tasks/{task_id}")
async def get_background_task(task_id: str):
    return task_manager.get_task_status(task_id)
