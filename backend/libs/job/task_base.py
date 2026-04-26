"""
BaseTask — Lớp trừu tượng mà mọi task phải kế thừa.

Hướng dẫn tạo task mới:
========================
1. Tạo file mới trong thư mục `backend/tasks/` (ví dụ: `backend/tasks/my_task.py`).
2. Kế thừa `BaseTask` và điền các metadata bắt buộc:
   - `name`:        Tên định danh duy nhất, dùng làm node_type (snake_case).
   - `label`:       Tên hiển thị trên UI.
   - `description`: Mô tả ngắn về chức năng của task.
   - `category`:    Nhóm phân loại (ví dụ: "math", "data", "io").
   - `inputs`:      List các InputPort — định nghĩa dữ liệu đầu vào từ node trước.
   - `outputs`:     List các OutputPort — định nghĩa dữ liệu đầu ra truyền cho node sau.
   - `config_fields`: List các ConfigField — các tham số cấu hình tĩnh của node.
3. Implement phương thức `execute(inputs, config) -> dict`.
4. File sẽ tự động được phát hiện và đăng ký khi service khởi động.

Ví dụ đơn giản:
---------------
    from libs.job.task_base import BaseTask, InputPort, OutputPort, ConfigField
    from libs.job.registry import task_registry

    @task_registry.register
    class MyTask(BaseTask):
        name = "my_task"
        label = "My Task"
        description = "Does something useful."
        category = "custom"
        inputs = [InputPort(name="value", label="Value", type="number")]
        outputs = [OutputPort(name="result", label="Result", type="number")]
        config_fields = [
            ConfigField(name="multiplier", label="Multiplier", type="number", default=2)
        ]

        def execute(self, inputs: dict, config: dict) -> dict:
            value = inputs.get("value", 0)
            multiplier = config.get("multiplier", 2)
            return {"result": value * multiplier}
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Literal


# ---------------------------------------------------------------------------
# Port & Field type definitions
# ---------------------------------------------------------------------------

PortType = Literal["number", "string", "boolean", "any", "array", "object"]
FieldType = Literal["number", "string", "boolean", "select", "textarea"]


@dataclass
class InputPort:
    """Định nghĩa một cổng đầu vào của task."""
    name: str
    label: str
    type: PortType = "any"
    required: bool = False
    description: str = ""


@dataclass
class OutputPort:
    """Định nghĩa một cổng đầu ra của task."""
    name: str
    label: str
    type: PortType = "any"
    description: str = ""


@dataclass
class SelectOption:
    """Một lựa chọn trong ConfigField kiểu 'select'."""
    value: str
    label: str


@dataclass
class ConfigField:
    """
    Định nghĩa một tham số cấu hình tĩnh của task.
    Frontend sẽ render form input tương ứng với `type`.
    """
    name: str
    label: str
    type: FieldType = "string"
    default: Any = None
    required: bool = False
    description: str = ""
    options: list[SelectOption] = field(default_factory=list)  # Dùng cho type='select'
    placeholder: str = ""


# ---------------------------------------------------------------------------
# BaseTask
# ---------------------------------------------------------------------------

class BaseTask(ABC):
    """
    Lớp trừu tượng mà mọi task phải kế thừa.
    Các thuộc tính class-level là metadata, không cần khởi tạo instance.
    """
    name: str = ""           # Unique identifier — dùng làm node_type trong DB
    label: str = ""          # Tên hiển thị trên UI
    description: str = ""    # Mô tả ngắn
    category: str = "general" # Nhóm phân loại để UI có thể group lại

    inputs: list[InputPort] = []
    outputs: list[OutputPort] = []
    config_fields: list[ConfigField] = []
    is_dynamic: bool = False # Nếu True, Frontend cần gọi API để lấy schema dựa trên config
    memory_mb: int = 100    # Default memory usage estimate

    @classmethod
    def get_dynamic_inputs(cls, config: dict) -> list[InputPort]:
        """Trả về danh sách cổng vào dựa trên cấu hình hiện tại."""
        return cls.inputs

    @classmethod
    def get_dynamic_outputs(cls, config: dict) -> list[OutputPort]:
        """Trả về danh sách cổng ra dựa trên cấu hình hiện tại."""
        return cls.outputs

    @abstractmethod
    def execute(self, inputs: dict, config: dict, **kwargs) -> dict:
        """
        Hàm chính thực thi logic của task.

        Args:
            inputs: Dict chứa output của các node trước, được map theo InputPort.name.
            config: Dict chứa các giá trị cấu hình từ ConfigField, theo field.name.
            **kwargs: Các tham số context bổ sung (ví dụ: pipeline_run_id, db session).

        Returns:
            Dict chứa kết quả đầu ra, các key phải khớp với OutputPort.name.
        """
        ...

    @classmethod
    def to_schema(cls) -> dict:
        """Xuất toàn bộ metadata thành dict để gửi cho frontend."""
        return {
            "name": cls.name,
            "label": cls.label,
            "description": cls.description,
            "category": cls.category,
            "is_dynamic": cls.is_dynamic,
            "inputs": [
                {
                    "name": p.name,
                    "label": p.label,
                    "type": p.type,
                    "required": p.required,
                    "description": p.description,
                }
                for p in cls.inputs
            ],
            "outputs": [
                {
                    "name": p.name,
                    "label": p.label,
                    "type": p.type,
                    "description": p.description,
                }
                for p in cls.outputs
            ],
            "config_fields": [
                {
                    "name": f.name,
                    "label": f.label,
                    "type": f.type,
                    "default": f.default,
                    "required": f.required,
                    "description": f.description,
                    "options": [{"value": o.value, "label": o.label} for o in f.options],
                    "placeholder": f.placeholder,
                }
                for f in cls.config_fields
            ],
            "memory_mb": cls.memory_mb,
        }
