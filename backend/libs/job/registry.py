"""
TaskRegistry — Bộ đăng ký task tự động (Singleton).

Cách hoạt động:
- Dùng decorator `@task_registry.register` hoặc kế thừa BaseTask và gọi register thủ công.
- Khi `load_all_tasks()` được gọi lúc khởi động service, tất cả file trong `tasks/`
  sẽ được import, kích hoạt các decorator và tự điền vào registry.
"""
import importlib
import pkgutil
from typing import Type, TYPE_CHECKING

if TYPE_CHECKING:
    from libs.job.task_base import BaseTask


class TaskRegistry:
    """Singleton registry lưu trữ tất cả task đã đăng ký."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._tasks: dict[str, Type["BaseTask"]] = {}
        return cls._instance

    def register(self, cls: Type["BaseTask"]) -> Type["BaseTask"]:
        """
        Decorator dùng để đăng ký một task vào registry.
        Dùng như sau:

            @task_registry.register
            class MyTask(BaseTask):
                name = "my_task"
                ...
        """
        from libs.job.task_base import BaseTask
        if not issubclass(cls, BaseTask):
            raise TypeError(f"{cls} must inherit from BaseTask")
        if not cls.name:
            raise ValueError(f"Task {cls} must define a 'name' class attribute")
        
        # Override if exists to support live-reloading of custom py uploads
        if cls.name in self._tasks:
            import logging
            logging.getLogger(__name__).warning(f"Task '{cls.name}' is being overwritten by {cls}")

        self._tasks[cls.name] = cls
        return cls

    def get(self, name: str) -> Type["BaseTask"] | None:
        """Lấy class task theo tên."""
        return self._tasks.get(name)

    def all(self) -> dict[str, Type["BaseTask"]]:
        """Trả về toàn bộ registry."""
        return dict(self._tasks)

    def schemas(self) -> list[dict]:
        """Trả về danh sách schema của tất cả task, sắp xếp theo category rồi label."""
        return sorted(
            [task_cls.to_schema() for task_cls in self._tasks.values()],
            key=lambda s: (s["category"], s["label"])
        )

    def execute(self, task_name: str, inputs: dict, config: dict, **kwargs) -> dict:
        """
        Tìm task theo tên và thực thi.

        Raises:
            KeyError: Nếu task_name không tồn tại trong registry.
        """
        task_cls = self._tasks.get(task_name)
        if task_cls is None:
            raise KeyError(f"Unknown task type: '{task_name}'. "
                           f"Available: {list(self._tasks.keys())}")
        task_instance = task_cls()
        
        # Chỉ pass những kwargs mà hàm execute thực sự hỗ trợ
        import inspect
        sig = inspect.signature(task_instance.execute)
        
        has_varkw = any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values())
        if has_varkw:
            valid_kwargs = kwargs
        else:
            valid_kwargs = {k: v for k, v in kwargs.items() if k in sig.parameters}
            
        return task_instance.execute(inputs=inputs, config=config, **valid_kwargs)


# Singleton instance dùng trong toàn bộ project
task_registry = TaskRegistry()


def load_all_tasks(package_name: str = "tasks") -> None:
    """
    Import tất cả module trong package `tasks` để kích hoạt các @task_registry.register.
    Được gọi một lần khi service khởi động (trong main.py).

    Args:
        package_name: Tên package chứa các file task (mặc định là 'tasks').
    """
    import tasks  # Import package root để pkgutil biết đường dẫn
    for module_info in pkgutil.walk_packages(
        path=tasks.__path__,
        prefix=tasks.__name__ + ".",
        onerror=lambda name: None,
    ):
        try:
            importlib.import_module(module_info.name)
        except Exception as e:
            print(f"Failed to load task module {module_info.name}: {e}")
