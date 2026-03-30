/**
 * 聊天页面 - 增强版
 * 支持流式输出、多轮对话、引用标注、思考过程展示、反馈功能
 */
import React, { useMemo, useState, useCallback } from 'react';
import { useXChat } from '@ant-design/x-sdk';
import { Bubble, Sender } from '@ant-design/x';
import { createRAGChatProvider } from '@/providers/RAGChatProvider';
import { ThinkingCard } from '@/components/ThinkingCard';
import { Citation, Citation as CitationMark } from '@/components/Citation';
import { CitationPanel, CitationItem } from '@/components/CitationPanel';
import { FeedbackButton } from '@/components/FeedbackButton';
import { submitFeedback } from '@/services/feedback';
import { message } from 'antd';
import './index.css';

interface ChatMessageExtra {
  thinking?: {
    usedToolCalling: boolean;
    searchQuery?: string;
    resultCount?: number;
    topScore?: number;
    message?: string;
  };
  citations?: CitationItem[];
  chatMessageId?: string;
}

const ChatPage: React.FC = () => {
  // 获取 token
  const token = localStorage.getItem('token') || '';

  // 引用面板状态
  const [citationPanelOpen, setCitationPanelOpen] = useState(false);
  const [currentCitations, setCurrentCitations] = useState<CitationItem[]>([]);

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

  // 处理反馈提交
  const handleFeedbackSubmit = useCallback(
    async (chatMessageId: string, data: { rating: number; comment?: string; tags?: string[] }) => {
      try {
        await submitFeedback({
          chatMessageId,
          rating: data.rating,
          comment: data.comment,
          tags: data.tags,
        });
        message.success('反馈已提交，感谢您的意见！');
      } catch (error) {
        console.error('Failed to submit feedback:', error);
        message.error('提交反馈失败，请稍后重试');
      }
    },
    []
  );

  // 显示引用面板
  const handleCitationClick = useCallback((citations: CitationItem[]) => {
    setCurrentCitations(citations);
    setCitationPanelOpen(true);
  }, []);

  // 渲染消息内容（支持引用标记解析）
  const renderContent = useCallback(
    (content: string, extra?: ChatMessageExtra) => {
      if (!extra?.citations || extra.citations.length === 0) {
        return <span>{content}</span>;
      }

      // 解析内容中的 [1]、[2] 等引用标记
      const parts = content.split(/(\[\d+\])/g);

      return (
        <div className="message-content">
          <div className="message-text">
            {parts.map((part, index) => {
              const match = part.match(/\[(\d+)\]/);
              if (match) {
                const citationIndex = parseInt(match[1], 10);
                const citation = extra.citations?.find((c) => c.index === citationIndex);
                if (citation) {
                  return (
                    <CitationMark
                      key={index}
                      index={citation.index}
                      source={citation.source}
                      score={citation.score}
                      onClick={() => handleCitationClick(extra.citations || [])}
                    />
                  );
                }
              }
              return <span key={index}>{part}</span>;
            })}
          </div>
        </div>
      );
    },
    [handleCitationClick]
  );

  // 解析消息额外数据
  const parseMessageExtra = useCallback((message: any): ChatMessageExtra => {
    // 尝试从消息内容中解析额外数据
    // 实际使用中，可能需要后端返回单独的字段的
    return {};
  }, []);

  return (
    <div className="chat-page">
      <div className="chat-container">
        {/* 消息列表 */}
        <div className="chat-messages">
          <Bubble.List
            items={messages.map((msg) => {
              const extra = parseMessageExtra(msg);
              const isAssistant = msg.message.role === 'assistant';

              return {
                key: msg.id,
                role: msg.message.role,
                placement: isAssistant ? 'start' : 'end',
                typing: msg.status === 'loading',
                avatar: isAssistant ? '🤖' : '👤',
                header: isAssistant && extra?.thinking ? (
                  <ThinkingCard
                    usedToolCalling={extra.thinking.usedToolCalling}
                    searchQuery={extra.thinking.searchQuery}
                    resultCount={extra.thinking.resultCount}
                    topScore={extra.thinking.topScore}
                    message={extra.thinking.message}
                    isLoading={msg.status === 'loading'}
                  />
                ) : undefined,
                content: renderContent(msg.message.content, extra),
                footer: isAssistant && extra?.chatMessageId ? (
                  <FeedbackButton
                    chatMessageId={extra.chatMessageId!}
                    onFeedbackSubmitted={() => {}}
                  />
                ) : undefined,
                styles: {
                  content: {
                    backgroundColor: isAssistant ? '#f0f0f0' : '#1890ff',
                    color: isAssistant ? '#000' : '#fff',
                    maxWidth: '80%',
                  },
                  body: {
                    padding: isAssistant ? '8px 12px' : '8px 12px',
                  },
                },
              };
            })}
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

      {/* 引用来源面板 */}
      <CitationPanel
        open={citationPanelOpen}
        onClose={() => setCitationPanelOpen(false)}
        citations={currentCitations}
      />
    </div>
  );
};

export default ChatPage;
