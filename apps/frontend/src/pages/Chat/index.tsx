/**
 * 聊天页面 - 混合方案
 * API: @ai-sdk/react useChat
 * UI: @ant-design/x components
 */
import React, { useState, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { Bubble, Sender } from '@ant-design/x';
import { ThinkingCard } from '@/components/ThinkingCard';
import { Citation } from '@/components/Citation';
import { CitationPanel, type CitationItem } from '@/components/CitationPanel';
import { FeedbackButton } from '@/components/FeedbackButton';
import { message } from 'antd';
import { submitFeedback } from '@/services/feedback';
import './index.css';

// Types for tool invocations from Vercel AI SDK
interface ToolInvocation {
  toolName: string;
  toolCallId: string;
  args: Record<string, any>;
  result?: {
    results?: Array<{
      index: number;
      source: string;
      content: string;
      score: number;
    }>;
  };
  state: 'partial-call' | 'call' | 'result';
}

// Extended message type with tool invocations and reasoning
interface ExtendedMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  toolInvocations?: ToolInvocation[];
}

const ChatPage: React.FC = () => {
  const token = localStorage.getItem('token') || '';

  // 引用面板状态
  const [citationPanelOpen, setCitationPanelOpen] = useState(false);
  const [currentCitations, setCurrentCitations] = useState<CitationItem[]>([]);

  // 使用 Vercel AI SDK 的 useChat hook
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
  } = useChat({
    api: `${import.meta.env.VITE_API_URL}/api/v1/chat/stream`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    onError: (error) => {
      console.error('Chat error:', error);
      message.error('发送失败，请重试');
    },
  });

  // 从 toolInvocations 提取 citations
  const extractCitations = useCallback(
    (toolInvocations: ToolInvocation[] | undefined): CitationItem[] => {
      if (!toolInvocations) return [];

      return toolInvocations
        .filter(
          (inv) =>
            inv.toolName === 'knowledge_base_search' && inv.result?.results,
        )
        .flatMap((inv) =>
          inv.result!.results!.map((r, idx) => ({
            index: idx + 1,
            chunkId: r.index.toString(),
            documentId: r.source,
            content: r.content,
            source: r.source,
            score: r.score,
          })),
        );
    },
    [],
  );

  // 渲染带引用标记的内容
  const renderContentWithCitations = useCallback(
    (content: string, citations: CitationItem[]) => {
      if (!citations || citations.length === 0) {
        return <span>{content}</span>;
      }

      const parts = content.split(/(\[\d+\])/g);

      return (
        <div className="message-content">
          <div className="message-text">
            {parts.map((part, idx) => {
              const match = part.match(/\[(\d+)\]/);
              if (match) {
                const citationIndex = parseInt(match[1]);
                const citation = citations.find((c) => c.index === citationIndex);
                if (citation) {
                  return (
                    <Citation
                      key={idx}
                      index={citation.index}
                      source={citation.source}
                      score={citation.score}
                      onClick={() => {
                        setCurrentCitations(citations);
                        setCitationPanelOpen(true);
                      }}
                    />
                  );
                }
              }
              return <span key={idx}>{part}</span>;
            })}
          </div>
        </div>
      );
    },
    [],
  );

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
    [],
  );

  // 转换消息格式给 Ant Design X 使用
  const bubbleItems = messages.map((msg) => {
    const extendedMsg = msg as ExtendedMessage;
    const isAssistant = extendedMsg.role === 'assistant';

    // 提取 citations
    const citations = isAssistant && extendedMsg.toolInvocations
      ? extractCitations(extendedMsg.toolInvocations)
      : [];

    // 提取检索元数据
    const toolInvocations = extendedMsg.toolInvocations || [];
    const searchTool = toolInvocations.find(
      (inv) => inv.toolName === 'knowledge_base_search',
    );

    return {
      key: extendedMsg.id,
      role: extendedMsg.role,
      placement: isAssistant ? 'start' : 'end',
      typing: isLoading && messages.indexOf(msg) === messages.length - 1 && isAssistant,
      avatar: isAssistant ? '🤖' : '👤',

      // Header: Reasoning + ThinkingCard
      header: isAssistant && (
        <>
          {/* Reasoning 展示 */}
          {extendedMsg.reasoning && (
            <div className="message-reasoning">
              <details>
                <summary>思考过程</summary>
                <div className="reasoning-content">
                  {extendedMsg.reasoning}
                </div>
              </details>
            </div>
          )}

          {/* Thinking Card（检索元数据） */}
          {searchTool && searchTool.state === 'result' && (
            <ThinkingCard
              usedToolCalling={true}
              searchQuery={searchTool.args?.query}
              resultCount={searchTool.result?.results?.length || 0}
              topScore={searchTool.result?.results?.[0]?.score}
              isLoading={false}
            />
          )}
        </>
      ),

      // Content: 带引用的文本
      content: isAssistant
        ? renderContentWithCitations(extendedMsg.content, citations)
        : extendedMsg.content,

      // Footer: FeedbackButton (需要从后端获取 chatMessageId)
      footer: isAssistant && extendedMsg.id && (
        <FeedbackButton
          chatMessageId={extendedMsg.id}
          onFeedbackSubmitted={handleFeedbackSubmit}
        />
      ),

      styles: {
        content: {
          backgroundColor: isAssistant ? '#f0f0f0' : '#1890ff',
          color: isAssistant ? '#000' : '#fff',
          maxWidth: '80%',
        },
      },
    };
  });

  // 自定义 submit 处理（集成 useChat）
  const onSubmit = useCallback(
    (nextContent: string) => {
      if (!nextContent.trim() || isLoading) return;

      // 设置 input 值并提交
      handleInputChange({ target: { value: nextContent } } as any);
      handleSubmit(new Event('submit'));
    },
    [handleInputChange, handleSubmit, isLoading],
  );

  return (
    <div className="chat-page">
      <div className="chat-container">
        {/* 消息列表 - 使用 Ant Design X Bubble.List */}
        <div className="chat-messages">
          <Bubble.List
            items={bubbleItems}
            style={{ maxHeight: 'calc(100vh - 200px)' }}
          />
        </div>

        {/* 输入区域 - 使用 Ant Design X Sender */}
        <div className="chat-input">
          <Sender
            value={input}
            onChange={handleInputChange}
            onSubmit={onSubmit}
            loading={isLoading}
            onCancel={stop}
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