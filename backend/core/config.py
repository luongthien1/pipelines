from pydantic_settings import BaseSettings


class Settings(BaseSettings):

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    POLL_INTERVAL: int = 5
    MAX_CONCURRENT: int = 3
    MAX_MEMORY_MB: int = 2048
    TASK_TIMEOUT: int = 300
    media_dir: str = "media"
    app_name: str = "FastAPI Example"


settings = Settings()
