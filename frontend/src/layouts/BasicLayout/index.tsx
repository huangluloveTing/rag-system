/**
 * 基础布局组件
 * 包含 Header + Sider + Content
 */
import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  HomeOutlined,
  CommentOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PoweroffOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import type { MenuProps } from 'antd';
import './index.css';

const { Header, Sider, Content } = Layout;

/**
 * 基础布局组件
 */
const BasicLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // 菜单配置
  const menuItems: MenuProps['items'] = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: '首页',
    },
    {
      key: '/chat',
      icon: <CommentOutlined />,
      label: '智能问答',
    },
    {
      key: '/documents',
      icon: <FileTextOutlined />,
      label: '文档管理',
    },
    {
      key: '/knowledge',
      icon: <DatabaseOutlined />,
      label: '知识库',
    },
    {
      key: '/monitor',
      icon: <BarChartOutlined />,
      label: '监控仪表盘',
    },
  ];

  // 用户菜单
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'logout',
      icon: <PoweroffOutlined />,
      label: '退出登录',
      onClick: () => {
        localStorage.removeItem('token');
        navigate('/login');
      },
    },
  ];

  // 菜单点击事件
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  return (
    <Layout className="basic-layout">
      {/* 侧边栏 */}
      <Sider trigger={null} collapsible collapsed={collapsed} className="layout-sider">
        <div className="logo">
          {collapsed ? 'RAG' : 'RAG 系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>

      {/* 主体内容 */}
      <Layout>
        {/* 顶部导航 */}
        <Header className="layout-header" style={{ background: colorBgContainer }}>
          <div className="header-left">
            {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
              className: 'trigger',
              onClick: () => setCollapsed(!collapsed),
            })}
          </div>
          <div className="header-right">
            <Menu
              mode="horizontal"
              items={userMenuItems}
              className="user-menu"
            />
          </div>
        </Header>

        {/* 内容区域 */}
        <Content
          className="layout-content"
          style={{
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default BasicLayout;
