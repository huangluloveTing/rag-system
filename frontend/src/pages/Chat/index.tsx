/**
 * 问答页面
 * 聊天界面，支持流式输出（Phase 2 实现）
 */
import React from 'react';
import { Card } from 'antd';

const ChatPage: React.FC = () => {
  return (
    <div className="chat-page">
      <Card title="智能问答">
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#999' }}>
          <p>问答功能开发中...</p>
          <p>Phase 2 将实现：</p>
          <ul style={{ textAlign: 'left', display: 'inline-block', marginTop: 16 }}>
            <li>聊天界面</li>
            <li>SSE 流式输出</li>
            <li>引用展示</li>
            <li>反馈组件（点赞/点踩）</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default ChatPage;
