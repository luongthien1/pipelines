import sys
import os
from contextlib import asynccontextmanager

# Add parent directory to path to allow importing make_task
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api import router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from libs.job.registry import load_all_tasks

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load task registry on startup so endpoints are ready immediately."""
    load_all_tasks()
    yield

app = FastAPI(title="Pipeline Manager", lifespan=lifespan)

# Include REST API
app.include_router(router, prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
