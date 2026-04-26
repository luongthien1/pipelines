import { useState, useEffect } from 'react';
import { Layout, Menu, Button, Input, Typography, message, Modal, Space, Tag, Popconfirm, Divider } from 'antd';
import { 
  FileTextOutlined, PlusOutlined, SaveOutlined, DeleteOutlined, 
  CodeOutlined, InfoCircleOutlined, DatabaseOutlined
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { getTaskFiles, getTaskFile, saveTaskFile, deleteTaskFile } from '../api/pipeline';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const TEMPLATE_CODE = `from typing import Any, Dict
from libs.job.task_base import BaseTask, Port, ConfigField
from libs.job.registry import task_registry

@task_registry.register
class MyCustomTask(BaseTask):
    """Mô tả nội dung task ở đây"""
    name = "custom_demo_task_id"
    label = "Custom Demo"
    description = "Task xử lý tuỳ chỉnh"
    category = "Custom"
    
    inputs = [
        Port(name="input_1", label="Input Val", type="any", required=True),
    ]
    outputs = [
        Port(name="output_1", label="Output Val", type="any"),
    ]
    
    config_fields = [
        ConfigField(name="multiplier", label="Hệ số", type="number", default=2),
    ]
    
    def execute(self, inputs: Dict[str, Any], config: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        val = inputs.get("input_1", 0)
        mult = config.get("multiplier", 1)
        
        # TODO: Implement your custom logic here
        
        try:
            result = float(val) * float(mult)
        except:
            result = 0
            
        return {"output_1": result}
`;

export default function TaskManagement() {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isNewFile, setIsNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const data = await getTaskFiles();
      setFiles(data);
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleSelectFile = async (filename: string) => {
    if (filename === 'DATA_TYPES_TAB') {
      setSelectedFile(filename);
      setIsNewFile(false);
      return;
    }
    
    setLoading(true);
    try {
      const data = await getTaskFile(filename);
      setSelectedFile(filename);
      setFileContent(data.content);
      setIsNewFile(false);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedFile(null);
    setIsNewFile(true);
    setNewFileName('custom_task.py');
    setFileContent(TEMPLATE_CODE);
  };

  const handleSave = async () => {
    let targetName = isNewFile ? newFileName : selectedFile;
    if (!targetName) return;
    if (!targetName.endsWith('.py')) {
      targetName += '.py';
    }

    setSaving(true);
    try {
      const res = await saveTaskFile(targetName, fileContent);
      message.success(res.message);
      if (isNewFile) {
        setIsNewFile(false);
        setSelectedFile(targetName);
        await loadFiles();
      }
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFile || isNewFile) return;
    try {
      await deleteTaskFile(selectedFile);
      message.success('File deleted successfully');
      setSelectedFile(null);
      setFileContent('');
      await loadFiles();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const menuItems = [
    {
      key: 'DATA_TYPES_TAB',
      icon: <DatabaseOutlined />,
      label: 'Core Data Types'
    },
    {
       type: 'divider',
    },
    {
      key: 'files-group',
      label: 'Python Tasks Files',
      type: 'group',
      children: files.map(f => ({
        key: f,
        icon: <FileTextOutlined />,
        label: f
      }))
    }
  ];

  return (
    <Layout style={{ height: 'calc(100vh - 64px)', background: '#fff' }}>
      <Sider width={250} theme="light" style={{ borderRight: '1px solid #f0f0f0', overflowY: 'auto' }}>
        <div style={{ padding: 16 }}>
          <Button type="dashed" block icon={<PlusOutlined />} onClick={handleCreateNew}>
            New Custom Task
          </Button>
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedFile ? [selectedFile] : []}
          items={menuItems as any}
          onClick={(e) => handleSelectFile(e.key)}
        />
      </Sider>
      <Content style={{ display: 'flex', flexDirection: 'column' }}>
        {selectedFile === 'DATA_TYPES_TAB' ? (
          <div style={{ padding: 32, maxWidth: 800 }}>
            <Title level={2}>Core Data Types</Title>
            <Text type="secondary" style={{ fontSize: 16, display: 'block', marginBottom: 24 }}>
              Hệ thống Pipeline sử dụng một tập hợp các kiểu dữ liệu quy chuẩn để đảm bảo sự liền mạch kết nối giữa các Node (Ports).
              Khi tạo Custom Tasks, bạn phải sử dụng các loại data types này trong biến <code>type</code>.
            </Text>

            <Divider />
            
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Title level={4}><Tag color="green">string</Tag> Văn bản</Title>
                <Text>Đại diện cho văn bản, chuỗi ký tự. Các Node xử lý nhãn (label), log, Text AI thường dùng Type này.</Text>
              </div>
              <div>
                <Title level={4}><Tag color="blue">number</Tag> Chữ số</Title>
                <Text>Đại diện cho các dạng số học (Integer, Float...). Toán học, đo đạc dữ liệu, tính toán trọng số, AI Core.</Text>
              </div>
              <div>
                <Title level={4}><Tag color="orange">boolean</Tag> Logic (True/False)</Title>
                <Text>Đại diện cho giá trị Đúng/Sai. Các Node luồng điều kiện (If/Else) thường sử dụng giá trị này làm cờ kiểm duyệt.</Text>
              </div>
              <div>
                <Title level={4}><Tag color="default">any</Tag> Cấu trúc tùy chỉnh (Dynamic/JSON)</Title>
                <Text>
                  Chấp nhận mọi loại dữ liệu (Object, Array, JSON, GeoJSON). Dùng khi bạn cần truyền tải cấu trúc phức tạp như 
                  tọa độ ảnh, danh sách đối tượng hay Metadata AI. Mặc định các Node khi xuất dict ra nên dùng type này nếu không rơi vào 3 loại trên.
                </Text>
              </div>
            </Space>

            <div style={{ marginTop: 40, padding: 16, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8 }}>
              <InfoCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
              <strong>Lưu ý:</strong> Khi kết nối trên Editor, dây cáp (edge) sẽ tự động đồng bộ màu sắc dựa trên Output Type để bạn dễ dàng quản lý và tránh các lỗi casting type không tương đồng.
            </div>
          </div>
        ) : (selectedFile || isNewFile) ? (
          <>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <CodeOutlined style={{ fontSize: 24, color: '#1677ff' }} />
                {isNewFile ? (
                  <Input 
                    value={newFileName} 
                    onChange={e => setNewFileName(e.target.value)} 
                    style={{ width: 200 }} 
                    placeholder="filename.py"
                  />
                ) : (
                  <Title level={4} style={{ margin: 0 }}>{selectedFile}</Title>
                )}
                {isNewFile && <Tag color="blue">Not saved</Tag>}
              </Space>
              <Space>
                {!isNewFile && (
                  <Popconfirm title="Are you sure you want to delete this specific file?" onConfirm={handleDelete} okButtonProps={{ danger: true }}>
                    <Button danger icon={<DeleteOutlined />}>Delete</Button>
                  </Popconfirm>
                )}
                <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
                  Save & Deploy
                </Button>
              </Space>
            </div>
            <div style={{ flex: 1 }}>
              <Editor
                height="100%"
                defaultLanguage="python"
                value={fileContent}
                onChange={(val) => setFileContent(val || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                }}
              />
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#8c8c8c' }}>
            <CodeOutlined style={{ fontSize: 64, opacity: 0.2, marginBottom: 16 }} />
            <Title level={4} style={{ color: '#8c8c8c' }}>Task Types Management</Title>
            <Text type="secondary">Select a file from the sidebar to edit or review code.</Text>
          </div>
        )}
      </Content>
    </Layout>
  );
}
