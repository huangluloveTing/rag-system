/**
 * 文档管理页面
 * 文档上传、列表、删除（Phase 2 实现）
 */
import React from 'react';
import { Card } from 'antd';

const DocumentsPage: React.FC = () => {
  return (
    <div className="documents-page">
      <Card title="文档管理">
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#999' }}>
          <p>文档管理功能开发中...</p>
          <p>Phase 2 将实现：</p>
          <ul style={{ textAlign: 'left', display: 'inline-block', marginTop: 16 }}>
            <li>拖拽上传</li>
            <li>进度条显示</li>
            <li>文档列表</li>
            <li>删除文档</li>
            <li>重新索引</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default DocumentsPage;
