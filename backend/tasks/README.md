# Hướng dẫn tạo Custom Node Task

Pipeline Manager cho phép bạn mở rộng khả năng xử lý bằng cách viết các file Python chứa các Custom Task Class.

Sau khi file được đặt vào thư mục `tasks/` (hoặc upload qua giao diện), hệ thống sẽ tự động quét, parse cấu hình và hiển thị nó trong Node Picker của giao diện.

## Cấu trúc cơ bản của một Task

Tất cả các Node Task đều phải:
1. Kế thừa từ `BaseTask` (import từ `libs.job.task_base`).
2. Sử dụng decorator `@task_registry.register` (import từ `libs.job.registry`) để đăng ký với hệ thống.
3. Khai báo các thuộc tính siêu dữ liệu (metadata): `name`, `label`, `description`, `category`.
4. Khai báo `inputs` (đầu vào) và `outputs` (đầu ra) dưới dạng danh sách `Port`.
5. Khai báo các thiết lập cấu hình của Node thông qua biến `config_fields` (sẽ được UI build thành Form động).
6. Implement logic thực thi chính trong hàm `execute`.

### File mẫu chuẩn (Template)

Hãy lưu ý code sau khi viết xong, nếu đẩy thẳng vào thư mục `backend/tasks/` sẽ hoạt động ngay lập tức:

```python
from typing import Any, Dict
from libs.job.task_base import BaseTask, Port, ConfigField
from libs.job.registry import task_registry

@task_registry.register
class MyCustomTask(BaseTask):
    """
    Hãy thêm docstring giải thích chi tiết task này làm gì.
    UI có thể sử dụng thông tin này ở các bản cập nhật sau.
    """
    
    # 1. Định danh Node (name phải là duy nhất trên toàn bộ hệ thống)
    name = "my_custom_task"
    label = "My Custom Node"
    description = "Xử lý dữ liệu văn bản thành mô hình AI"
    category = "AI / Text Processing"  # Sắp xếp thư mục trong UI
    
    # 2. Định nghĩa Ports (Inputs & Outputs)
    # Các loại type có thể có: "string", "number", "boolean", "any"
    inputs = [
        Port(name="input_text", label="Raw Text", type="string", required=True),
    ]
    outputs = [
        Port(name="result_score", label="AI Output", type="number"),
    ]
    
    # 3. Định nghĩa Form cấu hình (Cho phép người dùng nhập trực tiếp trên Modal UI)
    config_fields = [
        ConfigField(
            name="model_name",
            label="Chọn Mô Hình Nhận Diện",
            type="select",
            options=[
                {"label": "GPT-4", "value": "gpt-4"},
                {"label": "Mistral", "value": "mistral"},
            ],
            default="gpt-4"
        ),
        ConfigField(
            name="threshold",
            label="Ngưỡng chắc chắn (Threshold)",
            type="number",
            default=0.8,
            description="Số càng cao, kết quả càng nghiêm ngặt"
        ),
    ]
    
    # 4. Hàm thực thi (Core Logic)
    def execute(self, inputs: Dict[str, Any], config: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """
        inputs: Dictionary chứa dữ liệu được bắn sang từ các node trước.
        config: Dictionary chứa thiết lập từ UI (model_name, threshold).
        **kwargs: Có thể chứa `pipeline_run` (toàn bộ pipeline) nếu bạn cần truy cập DB.
        
        Trả về một Dictionary có key HOÀN TOÀN TRÙNG KHỚP với danh sách outputs đã khai báo.
        """
        
        # Đọc tham số setup:
        model = config.get("model_name", "gpt-4")
        threshold = config.get("threshold", 0.5)
        
        # Đọc dữ liệu đầu vào từ dây cáp (Edge kết nối)
        text_data = inputs.get("input_text", "")
        
        # ------- CHẠY LOGIC XỬ LÝ CHÍNH --------
        print(f"Tiến hành đưa dữ liệu {text_data} vào mô hình {model}")
        score = 0.95
        
        # Tự động bắt lỗi nếu config không thoả mãn
        if score < float(threshold):
            raise ValueError(f"Điểm chấm: {score} thấp hơn cấu hình yêu cầu {threshold}!")
        
        # Trả về kết quả đầu ra
        return {
            "result_score": score
        }
```

## Các Mẹo (Tips)

* **Inputs chưa được nối (Unconnected Inputs)**: Nếu người dùng không kéo dây vào cổng input, biến đó trong dictionary sẽ là `None` hoặc dùng `dict.get()` bạn tự set mặc định. Nên dùng `required=True` để UI bắt buộc nối nếu luồng đó là bắt buộc.
* **Sử dụng môi trường DB (kwargs)**: Nếu Task của bạn yêu cầu thao tác cơ sở dữ liệu nội bộ (chẳng hạn đọc thông tin MasterData):
  * Cung cấp `db=kwargs.get('db')`
  * Bạn sẽ nhận được the SQLAlchemy Session và có thể `.query()`
* **Sự cố Node không hiển thị**: Khi thả file code của bạn vào `backend/tasks/`, hãy quan sát log của FastAPI Server. Nếu có lỗi Syntax (sai thụt lề, thiếu Import), API sẽ in ra dòng "Failed to load task module..." và Node sẽ không hiển thị trên danh sách chọn.
