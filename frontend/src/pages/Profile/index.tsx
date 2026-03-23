/**
 * 个人中心页面
 * 用户信息管理
 */
import React from 'react';
import { Card, Descriptions, Avatar, Button } from 'antd';
import { UserOutlined, EditOutlined } from '@ant-design/icons';

const ProfilePage: React.FC = () => {
  // TODO: 从 API 获取用户信息
  const user = {
    username: 'admin',
    email: 'admin@example.com',
    role: '管理员',
  };

  return (
    <div className="profile-page">
      <Card title="个人中心">
        <Descriptions column={1} size="default">
          <Descriptions.Item label="头像">
            <Avatar size={64} icon={<UserOutlined />} />
          </Descriptions.Item>
          <Descriptions.Item label="用户名">{user.username}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{user.email}</Descriptions.Item>
          <Descriptions.Item label="角色">{user.role}</Descriptions.Item>
        </Descriptions>
        
        <div style={{ marginTop: 24 }}>
          <Button type="primary" icon={<EditOutlined />}>
            编辑资料
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ProfilePage;
