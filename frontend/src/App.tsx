/**
 * 应用主入口
 * 配置路由和全局主题
 */
import React from 'react';
import { ConfigProvider, theme } from 'antd';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import zhCN from 'antd/locale/zh_CN';
import BasicLayout from '@/layouts/BasicLayout';
import LoginPage from '@/pages/Login';
import ChatPage from '@/pages/Chat';
import DocumentsPage from '@/pages/Documents';
import KnowledgePage from '@/pages/Knowledge';
import MonitorPage from '@/pages/Monitor';
import HomePage from '@/pages/Home';
import ProfilePage from '@/pages/Profile';
import './App.css';

// 路由守卫组件
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          {/* 登录页 */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* 需要认证的路由 */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <BasicLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HomePage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="knowledge" element={<KnowledgePage />} />
            <Route path="monitor" element={<MonitorPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          
          {/* 默认重定向 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
