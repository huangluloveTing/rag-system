/**
 * 聊天服务 API
 * 对接后端的 OpenAI Chat Completions API
 */
import { post } from '@/utils/request';

// OpenAI Chat 消息格式
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Chat Completion 请求参数
export interface ChatCompletionParams {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

// Chat Completion 响应
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// RAG 聊天请求参数
export interface RAGChatParams {
  question: string;
  knowledgeBaseId?: string;
  sessionId?: string;
  stream?: boolean;
}

// RAG 聊天响应
export interface RAGChatResponse {
  answer: string;
  sessionId: string;
  references: Array<{
    chunkId: string;
    documentId: string;
    content: string;
    score: number;
    metadata?: any;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI Chat Completion（非流式）
 */
export function chatCompletion(data: ChatCompletionParams) {
  return post<ChatCompletionResponse>('/v1/chat/completions', data);
}

/**
 * OpenAI Chat Completion（流式 SSE）
 * 使用 EventSource 处理流式响应
 */
export async function chatCompletionStream(
  data: ChatCompletionParams,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void
) {
  const token = localStorage.getItem('token');
  const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/chat/completions/stream`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No reader available');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.trim().startsWith('data:')) {
          const dataStr = line.trim().substring(5).trim();

          if (dataStr === '[DONE]') {
            onComplete();
            return;
          }

          try {
            const parsed = JSON.parse(dataStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              onChunk(content);
            }
          } catch (e) {
            console.error('Failed to parse SSE chunk:', e);
          }
        }
      }
    }

    onComplete();
  } catch (error) {
    onError(error as Error);
  }
}

/**
 * RAG 聊天（非流式）
 */
export function ragChat(data: RAGChatParams) {
  return post<RAGChatResponse>('/v1/chat', data);
}

/**
 * RAG 聊天（流式）
 */
export async function ragChatStream(
  data: RAGChatParams,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void
) {
  const token = localStorage.getItem('token');
  const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/chat/stream`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No reader available');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      onChunk(chunk);
    }

    onComplete();
  } catch (error) {
    onError(error as Error);
  }
}