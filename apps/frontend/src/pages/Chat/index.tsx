/**
 * 聊天页面 - 使用 Ant Design X SDK
 * 支持流式输出、多轮对话
 */
import React, { useMemo } from 'react';
import { useXChat } from '@ant-design/x-sdk';
import { Bubble, Sender } from '@ant-design/x';
import { createRAGChatProvider } from '@/providers/RAGChatProvider';
import './index.css';

const ChatPage: React.FC = () => {
  // 获取 token
  const token = localStorage.getItem('token') || '';

  // 创建 Provider 实例（使用 useMemo 避免重复创建）
  const provider = useMemo(() => {
    const apiUrl = `${
      import.meta.env.VITE_API_URL || 'http://localhost:3000'
    }/api/v1/chat/completions`;
    return createRAGChatProvider(apiUrl, token);
  }, [token]);

  // 使用 useXChat Hook
  const { messages, onRequest, isRequesting, abort } = useXChat({
    provider,
  });

  // 发送消息
  const handleSubmit = (content: string) => {
    if (!content.trim() || isRequesting) return;

    // 构建消息历史
    const messageHistory = messages.map((msg) => ({
      role: msg.message.role as 'user' | 'assistant',
      content: msg.message.content,
    }));

    // 添加当前用户消息
    messageHistory.push({
      role: 'user',
      content,
    });

    // 发送请求
    onRequest({
      messages: messageHistory,
    });
  };

  return (
    <div className="chat-page">
      <div className="chat-container">
        {/* 消息列表 */}
        <div className="chat-messages">
          <Bubble.List
            items={messages.map((msg) => ({
              key: msg.id,
              role: msg.message.role,
              content: msg.message.content,
              placement: msg.message.role === 'user' ? 'end' : 'start',
              typing: msg.status === 'loading',
              avatar: msg.message.role === 'assistant' ? '🤖' : '👤',
              styles: {
                content: {
                  backgroundColor:
                    msg.message.role === 'user' ? '#1890ff' : '#f0f0f0',
                  color: msg.message.role === 'user' ? '#fff' : '#000',
                },
              },
            }))}
            style={{ maxHeight: 'calc(100vh - 200px)' }}
          />
        </div>

        {/* 输入区域 */}
        <div className="chat-input">
          <Sender
            loading={isRequesting}
            onSubmit={handleSubmit}
            onCancel={abort}
            placeholder="输入你的问题... (Enter 发送，Shift + Enter 换行)"
          />
        </div>
      </div>
    </div>
  );
};

export default ChatPage;