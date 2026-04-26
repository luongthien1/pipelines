import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Button, Space, Popconfirm, Modal, Form, Input, Typography, Tag, Select
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DatabaseOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useDatasets, useCreateDataset, useUpdateDataset, useDeleteDataset, useTasks, formatDate } from '../hooks/useApi';
import type { Dataset } from '../types';

const { Title, Paragraph } = Typography;

const DatasetList: React.FC = () => {
  const navigate = useNavigate();
  const { data: datasets, isLoading, error } = useDatasets();
  const { data: tasks = [] } = useTasks();
  const createDataset = useCreateDataset();
  const updateDataset = useUpdateDataset();
  const deleteDataset = useDeleteDataset();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [form] = Form.useForm();

  const handleOpenCreate = () => {
    setEditingDataset(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleOpenEdit = (record: Dataset) => {
    setEditingDataset(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      task: record.task,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingDataset) {
        await updateDataset.mutateAsync({
          id: editingDataset.id,
          ...values,
        });
      } else {
        await createDataset.mutateAsync(values);
      }
      setModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteDataset.mutateAsync(id);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredDatasets = datasets?.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (d.task?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const columns: ColumnsType<Dataset> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      render: (name, record) => (
        <a onClick={() => navigate(`/datasets/${record.id}`)} style={{ fontWeight: 600 }}>
          <Space>
            <DatabaseOutlined />
            {name}
          </Space>
        </a>
      ),
    },
    {
      title: 'Task',
      dataIndex: 'task',
      width: 120,
      render: (task) => <Tag color="blue">{task}</Tag>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      ellipsis: true,
      render: (v) => v || <span style={{ color: '#ccc' }}>No description</span>,
    },
    {
      title: 'Versions',
      dataIndex: 'versions_count',
      width: 100,
      align: 'center',
      render: (count) => <Badge count={count || 0} showZero color="#52c41a" />,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      width: 150,
      render: (v) => formatDate(v),
    },
    {
      title: 'Actions',
      width: 220,
      render: (_, record) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => navigate(`/datasets/${record.id}`)}
          >
            Details
          </Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleOpenEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this dataset?"
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okType="danger"
          >
            <Button icon={<DeleteOutlined />} size="small" danger>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>AI Datasets</Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>Manage your training data and versions</Paragraph>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate} size="large">
          New Dataset
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search datasets..."
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
      </div>

      <Table
        rowKey="id"
        dataSource={filteredDatasets}
        columns={columns}
        loading={isLoading}
        pagination={{ pageSize: 10 }}
        style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden' }}
      />

      <Modal
        title={editingDataset ? 'Edit Dataset' : 'Create New Dataset'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editingDataset ? 'Update' : 'Create'}
        confirmLoading={createDataset.isPending || updateDataset.isPending}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter a dataset name' }]}
          >
            <Input placeholder="e.g., Satellite Imagery 2024" />
          </Form.Item>
          
          <Form.Item
            name="task"
            label="Task Type"
            rules={[{ required: true, message: 'Please select a task type' }]}
          >
            <Select placeholder="Select a task">
              {tasks.map((task: any) => (
                <Select.Option key={task.id} value={task.name}>
                  {task.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea placeholder="What is this dataset for?" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const Badge = ({ count, showZero, color }: { count: number, showZero?: boolean, color?: string }) => {
  if (count === 0 && !showZero) return null;
  return (
    <span style={{ 
      background: color || '#1890ff', 
      color: '#fff', 
      padding: '2px 8px', 
      borderRadius: '10px', 
      fontSize: '11px',
      fontWeight: 'bold'
    }}>
      {count}
    </span>
  );
};

export default DatasetList;
