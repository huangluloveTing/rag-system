/**
 * 个人中心页面
 * 用户信息管理
 */
import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Avatar, Button, Modal, Form, Input, Space } from 'antd';
import { UserOutlined, EditOutlined } from '@ant-design/icons';
import { getCurrentUser, updateCurrentUser, type UserInfo } from '@/services/auth';

const ProfilePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchUser = async () => {
    setLoading(true);
    try {
      const res = await getCurrentUser();
      setUser(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const openEdit = () => {
    if (!user) return;
    form.setFieldsValue({
      username: user.username,
      email: user.email,
    });
    setModalOpen(true);
  };

  const onSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const res = await updateCurrentUser({
        username: values.username,
        email: values.email,
      });
      setUser(res.data);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <Card
        title="个人中心"
        loading={loading}
        extra={
          <Space>
            <Button onClick={fetchUser}>刷新</Button>
            <Button type="primary" icon={<EditOutlined />} onClick={openEdit} disabled={!user}>
              编辑资料
            </Button>
          </Space>
        }
      >
        <Descriptions column={1} size="default">
          <Descriptions.Item label="头像">
            <Avatar size={64} icon={<UserOutlined />} />
          </Descriptions.Item>
          <Descriptions.Item label="用户 ID">{user?.id || '-'}</Descriptions.Item>
          <Descriptions.Item label="用户名">{user?.username || '-'}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{user?.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="角色">{user?.role || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {user?.createdAt ? new Date(user.createdAt).toLocaleString() : '-'}
          </Descriptions.Item>
        </Descriptions>

        <Modal
          title="编辑资料"
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          onOk={onSave}
          confirmLoading={saving}
          okText="保存"
        >
          <Form form={form} layout="vertical">
            <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input />
            </Form.Item>
            <Form.Item
              name="email"
              label="邮箱"
              rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}
            >
              <Input />
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default ProfilePage;
