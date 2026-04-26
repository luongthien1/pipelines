import os
import json
from dotenv import load_dotenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv()

from .db import Base, engine

# Import all models to ensure they are registered with Base.metadata
from .models.dataset import Dataset, DatasetItem, DatasetTask, DatasetVersion
from .models.deployment import Deployment
from .models.model import Model, ModelVersion
from .models.pipeline import Pipeline
from .routers import datasets, deployments, models, pipelines, configs

# Create the database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Model Building Platform API")

# Configure CORS
cors_origins_str = os.getenv("CORS_ORIGINS", '["*"]')
try:
    cors_origins = json.loads(cors_origins_str)
except json.JSONDecodeError:
    cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create static directory for image uploads if it doesn't exist
uploads_dir = os.getenv("UPLOADS_DIR", "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount(f"/{uploads_dir}", StaticFiles(directory=uploads_dir), name="uploads")

# Include routers
app.include_router(datasets.router, prefix="/api/datasets", tags=["datasets"])
app.include_router(models.router, prefix="/api/models", tags=["models"])
app.include_router(pipelines.router, prefix="/api/pipelines", tags=["pipelines"])
app.include_router(deployments.router, prefix="/api/deployments", tags=["deployments"])
app.include_router(configs.router, prefix="/api/configs", tags=["configs"])

@app.get("/")
def read_root():
    return {"message": "Welcome to AI Model Building Platform API"}
