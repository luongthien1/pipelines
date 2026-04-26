import React, { useEffect } from 'react';
import { Form, Select, Input, Button, Space } from 'antd';

interface ModelVersionFormProps {
  initialValues: {
    stage: string;
    status_note: string;
  };
  onSubmit: (values: any) => void;
  onCancel: () => void;
  isEditing: boolean;
  loading?: boolean;
}

const ModelVersionForm: React.FC<ModelVersionFormProps> = ({
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
        name="stage"
        label="Deployment Stage"
        rules={[{ required: true, message: 'Please select a stage' }]}
      >
        <Select placeholder="Select a stage">
          <Select.Option value="experimental">Experimental</Select.Option>
          <Select.Option value="development">Development</Select.Option>
          <Select.Option value="staging">Staging</Select.Option>
          <Select.Option value="production">Production</Select.Option>
          <Select.Option value="archived">Archived</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item
        name="status_note"
        label="Status Note"
      >
        <Input.TextArea 
          placeholder="Short status update or description of this version" 
          rows={3} 
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

export default ModelVersionForm;

