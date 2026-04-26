"""
tasks/io_tasks.py — Các task xuất/nhập dữ liệu cơ bản.
"""
from libs.job.task_base import BaseTask, InputPort, OutputPort, ConfigField, SelectOption
from libs.job.registry import task_registry


@task_registry.register
class PrintLogTask(BaseTask):
    """Ghi log một giá trị ra output, thường dùng để debug hoặc kết thúc pipeline."""
    name = "print_log"
    label = "Print / Log"
    description = "Logs the incoming data to the node's output log. Useful for debugging."
    category = "io"

    inputs = [
        InputPort(name="data", label="Data", type="any",
                  description="Any value to log."),
    ]
    outputs = [
        OutputPort(name="logged_msg", label="Log Message", type="string",
                   description="The formatted log message that was recorded."),
    ]
    config_fields = [
        ConfigField(name="message", label="Prefix Message", type="string",
                    default="Log:", placeholder="Optional prefix before the value",
                    description="A label to prepend to the logged value."),
    ]

    def execute(self, inputs: dict, config: dict) -> dict:
        msg = config.get("message", "Log:")
        # Log all inputs for better debugging
        input_summary = ", ".join([f"{k}={v}" for k, v in inputs.items()])
        log_msg = f"{msg} | Inputs: [{input_summary}]"
        
        # We can also print to stdout which worker might capture (if configured)
        print(f"PRINT_NODE: {log_msg}")
        
        return {"logged_msg": log_msg}


@task_registry.register
class StaticValueTask(BaseTask):
    """Phát ra một giá trị cố định (không cần input). Dùng để bắt đầu pipeline."""
    name = "static_value"
    label = "Static Value"
    description = "Emits a fixed constant value. Useful as a starting node or test fixture."
    category = "data"

    inputs = []
    outputs = [
        OutputPort(name="value", label="Value", type="any",
                   description="The constant value defined in config."),
    ]
    config_fields = [
        ConfigField(
            name="type", label="Value Type", type="select",
            default="number",
            options=[
                SelectOption(value="number", label="Number"),
                SelectOption(value="string", label="String"),
                SelectOption(value="boolean", label="Boolean"),
            ]
        ),
        ConfigField(name="value", label="Value", type="string",
                    default="0", placeholder="Enter a value",
                    description="Will be cast to the selected type."),
    ]

    def execute(self, inputs: dict, config: dict) -> dict:
        raw = config.get("value", "0")
        vtype = config.get("type", "number")
        if vtype == "number":
            try:
                out = float(raw)
            except (ValueError, TypeError):
                out = 0.0
        elif vtype == "boolean":
            out = str(raw).lower() in ("true", "1", "yes")
        else:
            out = str(raw)
        return {"value": out}
