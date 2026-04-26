import time
import random
from typing import Dict, Any

def execute_node(node_type: str, config: Dict[str, Any], inputs: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mock implementation of a task executor.
    Based on node_type, it executes specific logic.
    """
    # Xử lý mô phỏng
    time.sleep(1) # Giả lập I/O hoặc tính toán
    
    if node_type == "math_add":
        val1 = config.get("value1", inputs.get("val1", 0))
        val2 = config.get("value2", inputs.get("val2", 0))
        return {"result": float(val1) + float(val2)}
    
    elif node_type == "random_number":
        min_val = config.get("min", 0)
        max_val = config.get("max", 100)
        return {"number": random.randint(min_val, max_val)}
    
    elif node_type == "print_log":
        msg = config.get("message", "No message")
        data = inputs.get("data", None)
        log_msg = f"{msg} | Input Data: {data}"
        print("WORKER EXEC:", log_msg)
        return {"logged_msg": log_msg}

    # Default fallback behavior
    return {"status": "executed", "received_inputs": inputs, "config": config}
