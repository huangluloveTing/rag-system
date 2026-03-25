/**
 * 个人中心页面
 * 用户信息管理
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Descriptions,
  Avatar,
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
} from 'antd';
import {
  UserOutlined,
  EditOutlined,
  LogoutOutlined,
  LockOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, type User } from '@/services/user';
import { updateCurrentUser } from '@/services/user';
import { logout } from '@/services/auth';
import './index.css';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 加载用户信息
  const loadUserInfo = async () => {
    setLoading(true);
    try {
      const res = await getCurrentUser();
      setUser(res.data);
    } catch (error) {
      console.error('Failed to load user info:', error);
      message.error('加载用户信息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserInfo();
  }, []);

  // 打开编辑模态框
  const openEditModal = () => {
    if (user) {
      form.setFieldsValue({
        email: user.email,
      });
      setEditModalVisible(true);
    }
  };

  // 提交更新
  const handleUpdate = async () => {
    try {
      const values = await form.validateFields();
      const params: any = {};

      if (values.email && values.email !== user?.email) {
        params.email = values.email;
      }

      if (values.password) {
        params.password = values.password;
      }

      if (Object.keys(params).length === 0) {
        message.info('没有需要更新的信息');
        return;
      }

      await updateCurrentUser(params);
      message.success('更新成功');
      setEditModalVisible(false);
      loadUserInfo();
      form.resetFields();
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  // 退出登录
  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出',
      content: '确定要退出登录吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        logout();
        navigate('/login');
      },
    });
  };

  // 角色显示名
  const getRoleName = (role: string) => {
    const roleMap: Record<string, string> = {
      admin: '管理员',
      user: '普通用户',
    };
    return roleMap[role] || role;
  };

  return (
    <div className="profile-page">
      <Card title="个人中心" loading={loading}>
        {user && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Avatar size={80} icon={<UserOutlined />} />
            </div>

            <Descriptions column={1} bordered>
              <Descriptions.Item label="用户名">{user.username}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{user.email}</Descriptions.Item>
              <Descriptions.Item label="角色">{getRoleName(user.role)}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(user.createdAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 24 }}>
              <Space>
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={openEditModal}
                >
                  编辑资料
                </Button>
                <Button
                  danger
                  icon={<LogoutOutlined />}
                  onClick={handleLogout}
                >
                  退出登录
                </Button>
              </Space>
            </div>
          </>
        )}
      </Card>

      {/* 编辑资料模态框 */}
      <Modal
        title="编辑资料"
        open={editModalVisible}
        onOk={handleUpdate}
        onCancel={() => {
          setEditModalVisible(false);
          form.resetFields();
        }}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="邮箱" />
          </Form.Item>

          <Form.Item
            label="新密码"
            name="password"
            extra="如果不修改密码，请留空"
            rules={[
              { min: 6, message: '密码至少 6 个字符' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="新密码（可选）" />
          </Form.Item>

          <Form.Item
            label="确认密码"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="确认新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProfilePage;
