/**
 * 首页
 * 显示系统概览和快捷入口
 */
import React from 'react';
import { Card, Row, Col, Statistic, Progress } from 'antd';
import {
  FileTextOutlined,
  CommentOutlined,
  DatabaseOutlined,
  UserOutlined,
} from '@ant-design/icons';

const HomePage: React.FC = () => {
  return (
    <div className="home-page">
      <h1>欢迎使用 RAG 系统</h1>
      
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="文档总数"
              value={156}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日问答"
              value={89}
              prefix={<CommentOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="知识库"
              value={12}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="活跃用户"
              value={45}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="系统状态">
            <div style={{ padding: '16px 0' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8 }}>向量数据库</div>
                <Progress percent={98} status="active" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8 }}>存储空间</div>
                <Progress percent={75} />
              </div>
              <div>
                <div style={{ marginBottom: 8 }}>API 健康</div>
                <Progress percent={100} strokeColor="#52c41a" />
              </div>
            </div>
          </Card>
        </Col>
        
        <Col xs={24} lg={12}>
          <Card title="快捷操作">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card hoverable size="small">
                  <Statistic
                    title="开始问答"
                    value={0}
                    prefix={<CommentOutlined />}
                    valueStyle={{ fontSize: 20 }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card hoverable size="small">
                  <Statistic
                    title="上传文档"
                    value={0}
                    prefix={<FileTextOutlined />}
                    valueStyle={{ fontSize: 20 }}
                  />
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default HomePage;
