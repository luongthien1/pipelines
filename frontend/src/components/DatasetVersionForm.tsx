import React, { useEffect } from 'react';
import { Form, Input, Button, Space } from 'antd';

interface DatasetVersionFormProps {
  initialValues: {
    version_name: string;
    data_info: string;
  };
  onSubmit: (values: any) => void;
  onCancel: () => void;
  isEditing: boolean;
  loading?: boolean;
}

const DatasetVersionForm: React.FC<DatasetVersionFormProps> = ({
  initialValues,
  onSubmit,
  onCancel,
  isEditing,
  loading,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [initialValues, form]);

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onSubmit}
      initialValues={initialValues}
      style={{ marginTop: 16 }}
    >
      <Form.Item
        name="version_name"
        label="Version Name"
        rules={[{ required: true, message: 'Please enter a version name' }]}
      >
        <Input placeholder="e.g. v1, v2..." />
      </Form.Item>

      <Form.Item
        name="data_info"
        label="Description / Info"
      >
        <Input.TextArea 
          placeholder="Describe what's in this version" 
          rows={4} 
        />
      </Form.Item>

      <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
        <Space>
          <Button onClick={onCancel}>
            Cancel
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {isEditing ? 'Update Version' : 'Create Version'}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default DatasetVersionForm;

