import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Button, Space, Popconfirm, Modal, Form, Input, Typography, Tag, Select, Badge
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, RobotOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useModels, useCreateModel, useUpdateModel, useDeleteModel, useTasks, formatDate } from '../hooks/useApi';
import type { Model } from '../types';

const { Title, Paragraph } = Typography;

const ModelList: React.FC = () => {
  const navigate = useNavigate();
  const { data: models, isLoading, error } = useModels();
  const { data: tasks = [] } = useTasks();
  const createModel = useCreateModel();
  const updateModel = useUpdateModel();
  const deleteModel = useDeleteModel();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [form] = Form.useForm();

  const handleOpenCreate = () => {
    setEditingModel(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleOpenEdit = (record: Model) => {
    setEditingModel(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      task: record.task,
      owner: record.owner,
      collaborators: record.collaborators,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingModel) {
        await updateModel.mutateAsync({ id: editingModel.id, ...values });
      } else {
        await createModel.mutateAsync(values);
      }
      setModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteModel.mutateAsync(id);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredModels = models?.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (m.task?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const columns: ColumnsType<Model> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      render: (name, record) => (
        <a onClick={() => navigate(`/models/${record.id}`)} style={{ fontWeight: 600 }}>
          <Space>
            <RobotOutlined />
            {name}
          </Space>
        </a>
      ),
    },
    {
      title: 'Task',
      dataIndex: 'task',
      width: 150,
      render: (task) => <Tag color="purple">{task}</Tag>,
    },
    {
      title: 'Owner',
      dataIndex: 'owner',
      width: 120,
    },
    {
      title: 'Versions',
      dataIndex: 'versions_count',
      width: 100,
      align: 'center',
      render: (count) => <Badge count={count || 0} showZero color="#1890ff" />,
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
            onClick={() => navigate(`/models/${record.id}`)}
          >
            Details
          </Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleOpenEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this model?"
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
          <Title level={4} style={{ margin: 0 }}>AI Models</Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>Track experiments, versions, and deployment stages</Paragraph>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate} size="large">
          New Model
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search models..."
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
      </div>

      <Table
        rowKey="id"
        dataSource={filteredModels}
        columns={columns}
        loading={isLoading}
        pagination={{ pageSize: 10 }}
        style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden' }}
      />

      <Modal
        title={editingModel ? 'Edit Model' : 'Create New Model'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editingModel ? 'Update' : 'Create'}
        confirmLoading={createModel.isPending || updateModel.isPending}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter a model name' }]}
          >
            <Input placeholder="e.g., YOLO-v8-Palm-Detection" />
          </Form.Item>
          
          <Form.Item
            name="task"
            label="Target Task"
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

          <Form.Item name="owner" label="Owner">
            <Input placeholder="Team or Individual name" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea placeholder="Model architecture details, etc." rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ModelList;

