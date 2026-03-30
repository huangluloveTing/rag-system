/**
 * 聊天页面 - 使用 Vercel AI SDK useChat
 */

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

// Extended message type with tool invocations
interface ExtendedMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  toolInvocations?: ToolInvocation[];
}

import React, { useState } from 'react';
import { useChat } from 'ai/react';
import { ThinkingCard } from '@/components/ThinkingCard';
import { Citation } from '@/components/Citation';
import { CitationPanel, CitationItem } from '@/components/CitationPanel';
import './index.css';

const ChatPage: React.FC = () => {
  const token = localStorage.getItem('token') || '';

  // 引用面板状态
  const [citationPanelOpen, setCitationPanelOpen] = useState(false);
  const [currentCitations, setCurrentCitations] = useState<CitationItem[]>(
    [],
  );

  // 使用 Vercel AI SDK 的 useChat hook
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
  } = useChat({
    api: `${import.meta.env.VITE_API_URL}/api/v1/chat/stream`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  // 从 toolInvocations 提取 citations
  const extractCitations = (toolInvocations: ToolInvocation[]): CitationItem[] => {
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
  };

  // 渲染带引用标记的内容
  const renderContentWithCitations = (
    content: string,
    citations: CitationItem[],
  ) => {
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
  };

  return (
    <div className="chat-page">
      <div className="chat-container">
        {/* 消息列表 */}
        <div className="chat-messages">
          {messages.map((msg) => {
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

            return (
              <div key={msg.id} className={`message ${msg.role}`}>
                {/* Reasoning 展示（如果有） */}
                {isAssistant && extendedMsg.reasoning && (
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
                {isAssistant && searchTool && (
                  <ThinkingCard
                    usedToolCalling={true}
                    searchQuery={searchTool.args?.query}
                    resultCount={searchTool.result?.results?.length || 0}
                    topScore={searchTool.result?.results?.[0]?.score}
                    isLoading={false}
                  />
                )}

                {/* 消息内容 */}
                <div className="message-content">
                  {isAssistant
                    ? renderContentWithCitations(msg.content, citations)
                    : msg.content}
                </div>
              </div>
            );
          })}
        </div>

        {/* 输入表单 */}
        <form onSubmit={handleSubmit} className="chat-input">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="输入你的问题..."
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? '发送中...' : '发送'}
          </button>
        </form>
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