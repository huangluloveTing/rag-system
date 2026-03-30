/**
 * 聊天服务
 * 处理用户对话、检索增强生成（RAG）
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RetrievalService, RetrievalResult } from '../retrieval/retrieval.service';
import { LlmService, ChatMessage } from '../llm/llm.service';

export interface ChatRequest {
  question: string;
  knowledgeBaseId?: string;
  sessionId?: string;
  stream?: boolean;
}

export interface ChatResponse {
  answer: string;
  sessionId: string;
  references: RetrievalResult[];
  citations?: Citation[]; // 引用标注
  thinking?: ThinkingInfo; // 思考过程信息
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface Citation {
  index: number;
  chunkId: string;
  documentId: string;
  content: string;
  source: string; // 文件名
  score: number;
}

export interface ThinkingInfo {
  usedToolCalling: boolean;
  searchQuery?: string;
  resultCount?: number;
  topScore?: number;
  message?: string; // 如"基于通用知识回答"
}

// OpenAI Chat Completion API 响应类型
export interface OpenAIChatCompletionResponse {
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

export interface OpenAIChatCompletionChunk {
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

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private retrievalService: RetrievalService,
    private llmService: LlmService
  ) {}

  /**
   * 处理聊天请求（非流式）
   */
  async chat(request: ChatRequest, userId: string): Promise<ChatResponse> {
    const { question, knowledgeBaseId, sessionId } = request;
    const startTime = Date.now();

    try {
      this.logger.debug(`Processing chat request: "${question.substring(0, 50)}..."`);

      // 1. 获取或创建会话
      let session = sessionId
        ? await this.prisma.chatSession.findUnique({
            where: { id: sessionId },
          })
        : null;

      if (!session) {
        session = await this.prisma.chatSession.create({
          data: {
            userId,
            knowledgeBaseId,
            title: question.substring(0, 50),
          },
        });
        this.logger.debug(`Created new session: ${session.id}`);
      }

      // 2. 获取历史消息
      const history = await this.getChatHistory(session.id);

      // 3. 构建 Prompt（使用 Tool Calling System Prompt）
      const messages: ChatMessage[] = [
        ...this.llmService.buildToolCallingPrompt(),
        ...history.slice(-12),  // 保留最近 12 条历史（从 6 条扩展到 12 条）
        { role: 'user', content: question }
      ];

      // 4. 调用 LLM 生成答案（启用 Tool Calling）
      const llmResponse = await this.llmService.generate(messages, {
        enableToolCalling: true,
      });

      // 5. 保存用户消息
      await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'user',
          content: question,
        },
      });

      // Transform tool results to match RetrievalResult structure for database storage
      const referencesForDB = llmResponse.toolCalls
        ? llmResponse.toolCalls.flatMap(tc =>
            tc.toolResult.results.map(result => ({
              chunkId: result.index.toString(), // Using index as chunkId
              documentId: result.source || '',  // Using source as documentId
              content: result.content,
              score: result.score,
              metadata: { source: result.source }
            }))
          )
        : [];

      // 6. 保存助手消息（包含 tool calling 元数据）
      await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          content: llmResponse.content,
          toolCalls: llmResponse.toolCalls ? { toJSON: () => llmResponse.toolCalls } as any : undefined,
          references: referencesForDB.length > 0 ? { toJSON: () => referencesForDB } as any : undefined,
          latencyMs: Date.now() - startTime,
          tokensUsed: llmResponse.usage.total_tokens,
        },
      });

      this.logger.debug(
        `Chat completed in ${Date.now() - startTime}ms, tokens: ${llmResponse.usage.total_tokens}, toolCalls: ${llmResponse.toolCalls?.length || 0}`
      );

      // 7. 记录检索日志（如果有 tool calling）
      if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
        await this.prisma.retrievalLog.create({
          data: {
            question,
            retrievedDocs: llmResponse.toolCalls.flatMap(tc =>
              tc.toolResult.results.map(r => ({
                chunkId: r.index.toString(), // Using index as chunkId
                documentId: r.source || '',  // Using source as documentId
                score: r.score,
              }))
            ),
            latencyMs: Date.now() - startTime,
            userId,
          },
        });
      }

      // Transform tool results to match RetrievalResult structure
      const references = llmResponse.toolCalls
        ? llmResponse.toolCalls.flatMap(tc =>
            tc.toolResult.results.map(result => ({
              chunkId: result.index.toString(), // Using index as chunkId
              documentId: result.source || '',  // Using source as documentId
              content: result.content,
              score: result.score,
              metadata: { source: result.source }
            }))
          )
        : [];

      // Build citations for frontend display
      const citations: Citation[] = references.map((r, idx) => ({
        index: idx + 1,
        chunkId: r.chunkId,
        documentId: r.documentId,
        content: r.content,
        source: (r.metadata?.source as string) || '未知文档',
        score: r.score,
      }));

      // Build thinking info
      const thinking: ThinkingInfo = llmResponse.toolCalls && llmResponse.toolCalls.length > 0
        ? {
            usedToolCalling: true,
            searchQuery: llmResponse.toolCalls[0]?.toolArgs?.query || question,
            resultCount: references.length,
            topScore: references.length > 0 ? references[0].score : 0,
          }
        : {
            usedToolCalling: false,
            message: '基于通用知识回答',
          };

      return {
        answer: llmResponse.content,
        sessionId: session.id,
        references,
        citations,
        thinking,
        usage: llmResponse.usage,
      };
    } catch (error) {
      this.logger.error(`Chat failed: ${error.message}`);
      throw error;
    }
  }

  async *chatStream(
    request: ChatRequest,
    userId: string
  ): AsyncGenerator<string> {
    const { question, knowledgeBaseId, sessionId } = request;
    const startTime = Date.now();

    try {
      this.logger.debug(`Processing streaming chat request`);

      // 1. 获取或创建会话
      let session = sessionId
        ? await this.prisma.chatSession.findUnique({
            where: { id: sessionId },
          })
        : null;

      if (!session) {
        session = await this.prisma.chatSession.create({
          data: {
            userId,
            knowledgeBaseId,
            title: question.substring(0, 50),
          },
        });
      }

      // 2. 获取历史消息
      const history = await this.getChatHistory(session.id);

      // 3. 构建 Prompt（使用 Tool Calling System Prompt）
      const messages: ChatMessage[] = [
        ...this.llmService.buildToolCallingPrompt(),
        ...history.slice(-12),  // 保留最近 12 条历史
        { role: 'user', content: question }
      ];

      // 4. 保存用户消息
      await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'user',
          content: question,
        },
      });

      // 5. 流式生成答案（启用 Tool Calling）
      const stream = await this.llmService.generateStream(messages, {
        enableToolCalling: true,
      });
      let fullContent = '';

      for await (const chunk of stream) {
        fullContent += chunk;
        yield chunk;
      }

      // 6. 保存助手消息（流式模式无法获取 tool calling 元数据）
      await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          content: fullContent,
          toolCalls: undefined,
          references: undefined,
          latencyMs: Date.now() - startTime,
        },
      });

      this.logger.debug(`Streaming chat completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      this.logger.error(`Streaming chat failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取会话历史
   */
  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 10, // 最多取 10 条历史
    });

    return messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
  }

  /**
   * 获取用户的会话列表
   */
  async getUserSessions(userId: string, page: number = 1, pageSize: number = 20) {
    const [sessions, total] = await Promise.all([
      this.prisma.chatSession.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          knowledgeBaseId: true,
        },
      }),
      this.prisma.chatSession.count({ where: { userId } }),
    ]);

    return {
      sessions,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取会话详情（包含所有消息）
   */
  async getSessionMessages(sessionId: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    return session;
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.userId !== userId) {
      throw new Error('Unauthorized');
    }

    await this.prisma.chatSession.delete({
      where: { id: sessionId },
    });

    this.logger.log(`Deleted session: ${sessionId}`);
  }

  /**
   * OpenAI 兼容的 Chat Completion API（非流式）
   */
  async openAIChatCompletion(
    messages: ChatMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
    } = {},
    userId: string
  ): Promise<OpenAIChatCompletionResponse> {
    const { temperature, maxTokens } = options;
    const startTime = Date.now();

    try {
      this.logger.debug(`Processing OpenAI chat completion request`);

      // 调用 LLM 生成答案
      const llmResponse = await this.llmService.generate(messages, {
        temperature,
        maxTokens,
      });

      const completionId = `chatcmpl-${Date.now()}`;
      const created = Math.floor(Date.now() / 1000);

      this.logger.debug(
        `OpenAI chat completion finished in ${Date.now() - startTime}ms`
      );

      return {
        id: completionId,
        object: 'chat.completion',
        created,
        model: llmResponse.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: llmResponse.content,
            },
            finish_reason: 'stop',
          },
        ],
        usage: llmResponse.usage,
      };
    } catch (error) {
      this.logger.error(`OpenAI chat completion failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * OpenAI 兼容的流式 Chat Completion API
   */
  async *openAIChatCompletionStream(
    messages: ChatMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
    } = {},
    userId: string
  ): AsyncGenerator<OpenAIChatCompletionChunk> {
    const { temperature, maxTokens } = options;

    try {
      this.logger.debug(`Processing OpenAI streaming chat completion`);

      const completionId = `chatcmpl-${Date.now()}`;
      const created = Math.floor(Date.now() / 1000);
      const model = this.llmService['model']; // 获取模型名称

      // 发送初始 chunk（role）
      yield {
        id: completionId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [
          {
            index: 0,
            delta: {
              role: 'assistant',
            },
            finish_reason: null,
          },
        ],
      };

      // 流式生成内容
      const stream = await this.llmService.generateStream(messages, {
        temperature,
        maxTokens,
      });

      for await (const contentChunk of stream) {
        yield {
          id: completionId,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: {
                content: contentChunk,
              },
              finish_reason: null,
            },
          ],
        };
      }

      // 发送结束 chunk
      yield {
        id: completionId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
      };

      this.logger.debug(`OpenAI streaming chat completion finished`);
    } catch (error) {
      this.logger.error(
        `OpenAI streaming chat completion failed: ${error.message}`
      );
      throw error;
    }
  }
}