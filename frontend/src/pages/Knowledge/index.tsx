/**
 * 知识库管理页面
 * 知识库创建、配置（Phase 2 实现）
 */
import React from 'react';
import { Card } from 'antd';

const KnowledgePage: React.FC = () => {
  return (
    <div className="knowledge-page">
      <Card title="知识库管理">
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#999' }}>
          <p>知识库管理功能开发中...</p>
          <p>Phase 2 将实现：</p>
          <ul style={{ textAlign: 'left', display: 'inline-block', marginTop: 16 }}>
            <li>创建知识库</li>
            <li>配置分块参数</li>
            <li>知识库列表</li>
            <li>编辑/删除知识库</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default KnowledgePage;
