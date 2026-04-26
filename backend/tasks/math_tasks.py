"""
tasks/math_tasks.py — Các task tính toán số học.
Đây là ví dụ mẫu để bạn tham khảo cách viết task.
"""
from libs.job.task_base import BaseTask, InputPort, OutputPort, ConfigField, SelectOption
from libs.job.registry import task_registry


@task_registry.register
class RandomNumberTask(BaseTask):
    """Sinh ra một số ngẫu nhiên trong khoảng [min, max]."""
    name = "random_number"
    label = "Random Number"
    description = "Generates a random integer within a configurable range."
    category = "data"

    inputs = []
    outputs = [
        OutputPort(name="number", label="Number", type="number",
                   description="The randomly generated number."),
    ]
    config_fields = [
        ConfigField(name="min", label="Min Value", type="number", default=0,
                    description="Lower bound (inclusive)."),
        ConfigField(name="max", label="Max Value", type="number", default=100,
                    description="Upper bound (inclusive)."),
    ]

    def execute(self, inputs: dict, config: dict) -> dict:
        import random
        min_val = int(config.get("min", 0))
        max_val = int(config.get("max", 100))
        return {"number": random.randint(min_val, max_val)}


@task_registry.register
class MathAddTask(BaseTask):
    """Cộng hai số đầu vào lại với nhau."""
    name = "math_add"
    label = "Math Add"
    description = "Adds two input numbers (val1 + val2)."
    category = "math"

    inputs = [
        InputPort(name="val1", label="Value 1", type="number", required=True),
        InputPort(name="val2", label="Value 2", type="number", required=True),
    ]
    outputs = [
        OutputPort(name="result", label="Result", type="number",
                   description="Sum of val1 and val2."),
    ]
    config_fields = []

    def execute(self, inputs: dict, config: dict) -> dict:
        val1 = float(inputs.get("val1", 0))
        val2 = float(inputs.get("val2", 0))
        return {"result": val1 + val2}


@task_registry.register
class MathMultiplyTask(BaseTask):
    """Nhân hai số với nhau."""
    name = "math_multiply"
    label = "Math Multiply"
    description = "Multiplies two input numbers (val1 × val2)."
    category = "math"

    inputs = [
        InputPort(name="val1", label="Value 1", type="number", required=True),
        InputPort(name="val2", label="Value 2", type="number", required=True),
    ]
    outputs = [
        OutputPort(name="result", label="Result", type="number"),
    ]
    config_fields = []

    def execute(self, inputs: dict, config: dict) -> dict:
        val1 = float(inputs.get("val1", 0))
        val2 = float(inputs.get("val2", 0))
        return {"result": val1 * val2}
