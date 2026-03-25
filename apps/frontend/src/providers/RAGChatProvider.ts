/**
 * 自定义 Chat Provider
 * 适配后端的 OpenAI Chat Completions API
 */
import { AbstractChatProvider, XRequest } from '@ant-design/x-sdk';
import type { XRequestOptions, TransformMessage } from '@ant-design/x-sdk';

// 定义消息类型
export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
  status?: 'loading' | 'success' | 'error';
}

// API 请求参数
interface ChatCompletionRequest {
  model?: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

// API 响应参数
interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

/**
 * RAG Chat Provider
 * 适配后端的 OpenAI Chat Completions API
 */
export class RAGChatProvider extends AbstractChatProvider<
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionChunk
> {
  /**
   * 转换请求参数
   * 将 useXChat 的参数转换为 API 需要的格式
   */
  transformParams(
    requestParams: Partial<ChatCompletionRequest>,
    options: XRequestOptions<ChatCompletionRequest, ChatCompletionChunk, ChatMessage>
  ): ChatCompletionRequest {
    return {
      model: 'qwen/qwen3.5-plus',
      messages: requestParams.messages || [],
      temperature: 0.7,
      stream: true,
      ...options?.params,
    };
  }

  /**
   * 转换本地消息
   * 用户发送消息时的格式
   */
  transformLocalMessage(requestParams: Partial<ChatCompletionRequest>): ChatMessage {
    const lastMessage = requestParams.messages?.[requestParams.messages.length - 1];

    return {
      id: `user-${Date.now()}`,
      content: lastMessage?.content || '',
      role: 'user',
      timestamp: Date.now(),
    };
  }

  /**
   * 转换响应消息
   * 处理流式响应数据
   */
  transformMessage(info: TransformMessage<ChatMessage, ChatCompletionChunk>): ChatMessage {
    const { originMessage, chunk } = info;

    // 处理 undefined 的情况
    if (!originMessage) {
      return {
        id: `assistant-${Date.now()}`,
        content: chunk.choices[0]?.delta?.content || '',
        role: 'assistant',
        timestamp: Date.now(),
        status: 'loading',
      };
    }

    // 处理结束标记
    if (chunk.choices[0]?.finish_reason === 'stop') {
      return {
        ...originMessage,
        status: 'success',
      };
    }

    // 累积响应内容
    const content = chunk.choices[0]?.delta?.content || '';

    return {
      ...originMessage,
      content: `${originMessage.content || ''}${content}`,
      role: 'assistant',
      status: 'loading',
    };
  }
}

/**
 * 创建 Provider 实例
 */
export const createRAGChatProvider = (apiUrl: string, token: string) => {
  // 创建 XRequest 实例
  const request = XRequest<ChatCompletionRequest, ChatCompletionChunk, ChatMessage>(apiUrl, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    params: {
      model: 'qwen/qwen3.5-plus',
      temperature: 0.7,
      stream: true,
    },
    manual: true, // Provider 场景必须设置为 true
  });

  // 创建并返回 Provider
  return new RAGChatProvider({
    request,
  });
};