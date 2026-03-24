/**
 * 聊天页面 - 使用 Vercel AI SDK
 * 支持流式输出、多轮对话、引用展示
 */
import React, { useRef, useEffect } from 'react';
import { Card, Input, Button, List, Typography, Space, Tag, Spin, Empty } from 'antd';
import { SendOutlined, LikeOutlined, DislikeOutlined, FileTextOutlined } from '@ant-design/icons';
import './index.css';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

const ChatPage: React.FC = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = React.useState('');
  const [messages, setMessages] = React.useState<Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
  }>>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const token = localStorage.getItem('token');

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 自定义提交处理
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: inputValue,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            model: 'qwen/qwen3.5-plus',
            messages: [...messages, userMessage].map(m => ({
              role: m.role,
              content: m.content,
            })),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage = {
        id: data.id || `assistant-${Date.now()}`,
        role: 'assistant' as const,
        content: data.choices[0].message.content,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setError(err.message || '发生错误');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-page">
      <Card
        className="chat-card"
        title="智能问答"
        extra={
          <Space>
            <Tag color="blue">基于知识库</Tag>
            <Tag color="green">流式输出</Tag>
          </Space>
        }
      >
        {/* 消息列表 */}
        <div className="chat-messages">
          {messages.length === 0 ? (
            <Empty
              description="开始对话吧"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ margin: '100px 0' }}
            />
          ) : (
            <List
              dataSource={messages}
              renderItem={(message) => (
                <List.Item
                  className={`chat-message ${message.role}`}
                  key={message.id}
                >
                  <div className="message-wrapper">
                    <div className="message-header">
                      <Tag color={message.role === 'user' ? 'blue' : 'green'}>
                        {message.role === 'user' ? '用户' : 'AI 助手'}
                      </Tag>
                    </div>
                    <div className="message-content">
                      <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                        {message.content}
                      </Paragraph>
                    </div>
                    {/* 操作按钮 */}
                    {message.role === 'assistant' && (
                      <div className="message-actions">
                        <Space size="small">
                          <Button
                            type="text"
                            size="small"
                            icon={<LikeOutlined />}
                            onClick={() => {
                              // TODO: 实现点赞
                            }}
                          />
                          <Button
                            type="text"
                            size="small"
                            icon={<DislikeOutlined />}
                            onClick={() => {
                              // TODO: 实现点踩
                            }}
                          />
                          <Button
                            type="text"
                            size="small"
                            icon={<FileTextOutlined />}
                            onClick={() => {
                              // TODO: 显示引用
                            }}
                          />
                        </Space>
                      </div>
                    )}
                  </div>
                </List.Item>
              )}
            />
          )}

          {/* 加载中提示 */}
          {isLoading && (
            <div className="chat-loading">
              <Spin tip="AI 正在思考..." />
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="chat-error">
              <Text type="danger">发生错误: {error}</Text>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <form onSubmit={onSubmit} className="chat-input-form">
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="输入你的问题..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  onSubmit(e);
                }
              }}
              style={{ borderRadius: '6px 0 0 6px' }}
            />
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              disabled={!inputValue.trim()}
              icon={<SendOutlined />}
              style={{ height: 'auto', borderRadius: '0 6px 6px 0' }}
            >
              发送
            </Button>
          </Space.Compact>
          <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
            提示：按 Enter 发送，Shift + Enter 换行
          </div>
        </form>
      </Card>
    </div>
  );
};

export default ChatPage;