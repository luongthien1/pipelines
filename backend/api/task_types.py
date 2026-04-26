from fastapi import APIRouter, File, UploadFile, HTTPException
import os
import shutil
import importlib
from libs.job.registry import task_registry

router = APIRouter()

@router.post("/upload", summary="Upload a python file containing a custom task node")
async def upload_task_node(file: UploadFile = File(...)):
    if not file.filename.endswith(".py"):
        raise HTTPException(400, "Only .py files are supported")
    
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_dir = os.path.join(base_dir, "tasks")
    
    file_path = os.path.join(target_dir, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    module_name = file.filename[:-3]
    module_path = f"tasks.{module_name}"
    try:
        import sys
        if module_path in sys.modules:
            importlib.reload(sys.modules[module_path])
        else:
            importlib.import_module(module_path)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(500, f"Custom node file contains errors and was removed. details: {str(e)}")
        
    return {"message": f"Successfully uploaded and loaded {file.filename}"}

from pydantic import BaseModel
class FileSaveRequest(BaseModel):
    filename: str
    content: str

@router.get("/files", summary="List all task python files")
def list_task_files():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_dir = os.path.join(base_dir, "tasks")
    files = []
    if os.path.exists(target_dir):
        for f in os.listdir(target_dir):
            if f.endswith(".py") and f != "__init__.py":
                files.append(f)
    return files

@router.get("/files/{filename}", summary="Get content of a task python file")
def get_task_file(filename: str):
    if not filename.endswith(".py") or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "Invalid filename")
    
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    file_path = os.path.join(base_dir, "tasks", filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(404, "File not found")
        
    with open(file_path, "r", encoding="utf-8") as f:
        return {"filename": filename, "content": f.read()}

@router.post("/files", summary="Create or update a task python file directly from code")
def save_task_file(req: FileSaveRequest):
    if not req.filename.endswith(".py") or ".." in req.filename or "/" in req.filename or "\\" in req.filename:
        raise HTTPException(400, "Invalid filename")
        
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    file_path = os.path.join(base_dir, "tasks", req.filename)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(req.content)
        
    # Hot-reload the module
    module_name = req.filename[:-3]
    module_path = f"tasks.{module_name}"
    try:
        import sys
        if module_path in sys.modules:
            importlib.reload(sys.modules[module_path])
        else:
            importlib.import_module(module_path)
    except Exception as e:
        # We don't remove the file here so the user can fix their code
        raise HTTPException(500, f"Saved successfully, but failed to load into registry. Error: {e}")
        
    return {"message": f"Successfully saved and loaded {req.filename}"}

@router.delete("/files/{filename}", summary="Delete a task python file")
def delete_task_file(filename: str):
    if not filename.endswith(".py") or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "Invalid filename")
        
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    file_path = os.path.join(base_dir, "tasks", filename)
    
    if os.path.exists(file_path):
        os.remove(file_path)
        
    # NOTE: We can't trivially unload the python module from sys.modules cleanly,
    # but the file is gone. Restarting the backend will wipe the class.
    return {"message": "Deleted successfully"}



@router.get("/", summary="List all registered task types")
def get_task_types() -> list[dict]:
    """
    Trả về danh sách đầy đủ schema của tất cả task đã đăng ký.
    Frontend dùng endpoint này để xây dựng node palette và render form config.
    """
    return task_registry.schemas()


@router.post("/{task_name}/schema", summary="Get dynamic schema for a task instance based on config")
def get_task_instance_schema(task_name: str, config: dict) -> dict:
    """
    Trả về schema của một task instance dựa trên tham số config.
    Dùng cho các node có cổng (inputs/outputs) thay đổi linh hoạt.
    """
    from fastapi import HTTPException
    task_cls = task_registry.get(task_name)
    if task_cls is None:
        raise HTTPException(status_code=404, detail=f"Task type '{task_name}' not found")
    
    schema = task_cls.to_schema()
    # Update dynamic ports
    schema["inputs"] = [
        {
            "name": p.name,
            "label": p.label,
            "type": p.type,
            "required": p.required,
            "description": p.description,
        }
        for p in task_cls.get_dynamic_inputs(config)
    ]
    schema["outputs"] = [
        {
            "name": p.name,
            "label": p.label,
            "type": p.type,
            "description": p.description,
        }
        for p in task_cls.get_dynamic_outputs(config)
    ]
    return schema
