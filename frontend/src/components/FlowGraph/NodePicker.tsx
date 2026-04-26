import { useState, useMemo } from 'react';
import { Input, List, Breadcrumb, Typography, Tag, Empty, Space, Upload, message, Button } from 'antd';
import { FolderOutlined, FileTextOutlined, SearchOutlined, LeftOutlined, PartitionOutlined, UploadOutlined } from '@ant-design/icons';
import type { TaskTypeSchema, Pipeline } from '../../types/pipeline';
import { uploadTaskNode } from '../../api/pipeline';



interface NodePickerProps {
  taskTypes: TaskTypeSchema[];
  pipelines: Pipeline[];
  onSelect: (task: TaskTypeSchema) => void;
  // If provided, only show tasks compatible with this port type
  filterType?: string; 
  // 'source' (output port) or 'target' (input port)
  filterDirection?: 'source' | 'target'; 
}

type PickerItem = 
  | { type: 'folder'; label: string; key: string; task?: never }
  | { type: 'node'; label: string; key: string; task: TaskTypeSchema };

export default function NodePicker({ taskTypes, pipelines, onSelect, filterType, filterDirection }: NodePickerProps) {
  const [search, setSearch] = useState('');
  const [currentPath, setCurrentPath] = useState<string[]>([]);

  // 1. Filter tasks by search and port compatibility
  const filteredTasks = useMemo(() => {
    let tasks = taskTypes;

    // Search filter
    if (search) {
      const s = search.toLowerCase();
      tasks = tasks.filter(t => 
        t.label.toLowerCase().includes(s) || 
        t.name.toLowerCase().includes(s) ||
        t.category.toLowerCase().includes(s)
      );
    }

    // Port type compatibility filter
    if (filterType && filterDirection) {
      tasks = tasks.filter(t => {
        // If we are dragging from a source (output), we need a node with a matching input
        const targetPorts = filterDirection === 'source' ? t.inputs : t.outputs;
        return targetPorts.some(p => p.type === filterType);
      });
    }

    return tasks;
  }, [taskTypes, search, filterType, filterDirection]);

  // 2. Get current level items (folders and nodes)
  const displayItems = useMemo(() => {
    // If searching, show a flat list of results
    if (search) {
      return filteredTasks.map(t => ({ type: 'node' as const, task: t, label: t.label, key: t.name }));
    }

    const folders = new Set<string>();
    const nodes: TaskTypeSchema[] = [];

    filteredTasks.forEach(t => {
      const catParts = t.category.split('/');
      
      // Check if this task is within the current path
      const currentLevelIndex = currentPath.length;
      const isMatch = currentPath.every((part, i) => catParts[i] === part);

      if (isMatch) {
        if (catParts.length > currentLevelIndex) {
          // It's a folder in the current level
          folders.add(catParts[currentLevelIndex]);
        } else {
          // It's a node in the current level
          nodes.push(t);
        }
      }
    });

    // Special handling for Pipelines folder
    if (currentPath.length === 0 && !search && pipelines.length > 0) {
      folders.add('Pipelines (Nested)');
    } else if (currentPath[0] === 'Pipelines (Nested)') {
      // Show pipelines as nodes
      pipelines.forEach(p => {
        nodes.push({
          name: 'sub_pipeline',
          label: p.name,
          description: p.description || `Execute pipeline: ${p.name}`,
          category: 'Pipelines (Nested)',
          inputs: [], // Dynamic ports will be fetched later
          outputs: [],
          config_fields: [
            { 
              name: 'sub_pipeline_id', 
              label: 'Pipeline ID', 
              type: 'number', 
              default: p.id,
              required: true,
              description: 'The ID of the pipeline to run',
              options: [],
              placeholder: ''
            }
          ],
          is_dynamic: true,
          memory_mb: 200
        });
      });
    }

    const items: PickerItem[] = [
      ...Array.from(folders).map(f => ({ type: 'folder' as const, label: f, key: f })),
      ...nodes.map(n => ({ type: 'node' as const, task: n, label: n.label, key: `${n.name}-${n.label}` }))
    ];

    return items;
  }, [filteredTasks, currentPath, search]);

  const handleItemClick = (item: PickerItem) => {
    if (item.type === 'folder') {
      setCurrentPath([...currentPath, item.label]);
    } else if (item.type === 'node') {
      onSelect(item.task);
    }
  };

  const handleBack = () => {
    setCurrentPath(prev => prev.slice(0, -1));
  };

  return (
    <div style={{ width: 320, maxHeight: 500, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 12px 8px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input 
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} 
            placeholder="Search nodes..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            autoFocus
          />
          <Upload
            accept=".py"
            showUploadList={false}
            beforeUpload={async (file) => {
              try {
                await uploadTaskNode(file as any);
                message.success(`${file.name} uploaded successfully!`);
                // Briefly inform the user and reload to fetch new task types
                setTimeout(() => window.location.reload(), 1000);
              } catch (e: any) {
                message.error(`Upload failed: ${e.message}`);
              }
              return false; // Prevent default upload behavior
            }}
          >
            <Button icon={<UploadOutlined />} title="Upload Custom Python Task" />
          </Upload>
        </div>
        {!search && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            {currentPath.length > 0 && (
              <LeftOutlined 
                style={{ cursor: 'pointer', fontSize: 12 }} 
                onClick={handleBack} 
              />
            )}
            <Breadcrumb 
              items={[
                { title: 'All', onClick: () => setCurrentPath([]), className: 'cursor-pointer' },
                ...currentPath.map((p, i) => ({ 
                  title: p, 
                  onClick: () => setCurrentPath(currentPath.slice(0, i + 1)),
                  className: 'cursor-pointer'
                }))
              ]} 
              style={{ fontSize: 12 }}
            />
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {displayItems.length > 0 ? (
          <List
            dataSource={displayItems}
            renderItem={item => (
              <List.Item 
                onClick={() => handleItemClick(item)}
                style={{ 
                  padding: '8px 16px', 
                  cursor: 'pointer', 
                  transition: 'background 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  // Use a simple hover background via a state-based approach or just a className if we define it.
                  // For simplicity in this environment, I'll use a local CSS style injection.
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {item.type === 'folder' ? (
                  <FolderOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                ) : item.task.name === 'sub_pipeline' ? (
                  <PartitionOutlined style={{ color: '#722ed1', fontSize: 18 }} />
                ) : (
                  <FileTextOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                )}
                <div style={{ flex: 1 }}>
                  <Typography.Text style={{ display: 'block' }}>{item.label}</Typography.Text>
                  {item.type === 'node' && (
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>{item.task.description.split('.')[0]}</Typography.Text>
                  )}
                </div>
              </List.Item>
            )}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No compatible nodes found" />
        )}
      </div>

      {filterType && (
        <div style={{ padding: 8, background: '#f6ffed', borderTop: '1px solid #b7eb8f', borderRadius: '0 0 8px 8px' }}>
          <Space>
            <Tag color="success">Filtering for: {filterType}</Tag>
            <Typography.Text type="secondary" style={{ fontSize: 10 }}>Matching {filterDirection === 'source' ? 'Inputs' : 'Outputs'}</Typography.Text>
          </Space>
        </div>
      )}
    </div>
  );
}
