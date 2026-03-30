/**
 * 聊天服务
 * 处理用户对话、检索增强生成（RAG）
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RetrievalService, RetrievalResult } from '../retrieval/retrieval.service';
import { LlmService, ChatMessage } from '../llm/llm.service';
import { AsyncIterableStream, convertToModelMessages, InferUIMessageChunk, ModelMessage, UIMessage } from 'ai';

export interface ChatRequest {
  messages: ChatMessage[];
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
    private llmService: LlmService,
  ) {}

  /**
   * 处理聊天请求（非流式）
   */
  // async chat(request: ChatRequest, userId: string): Promise<ChatResponse> {
  //   const { question, knowledgeBaseId, sessionId } = request;
  //   const startTime = Date.now();

  //   try {
  //     this.logger.debug(`Processing chat request: "${question.substring(0, 50)}..."`);

  //     // 1. 获取或创建会话
  //     let session = sessionId
  //       ? await this.prisma.chatSession.findUnique({
  //           where: { id: sessionId },
  //         })
  //       : null;

  //     if (!session) {
  //       session = await this.prisma.chatSession.create({
  //         data: {
  //           userId,
  //           knowledgeBaseId,
  //           title: question.substring(0, 50),
  //         },
  //       });
  //       this.logger.debug(`Created new session: ${session.id}`);
  //     }

  //     // 2. 获取历史消息
  //     const history = await this.getChatHistory(session.id);

  //     // 3. 构建 Prompt（使用 Tool Calling System Prompt）
  //     const messages: ChatMessage[] = [
  //       ...this.llmService.buildToolCallingPrompt(),
  //       ...history.slice(-12),  // 保留最近 12 条历史（从 6 条扩展到 12 条）
  //       { role: 'user', content: question }
  //     ];

  //     // 4. 调用 LLM 生成答案（启用 Tool Calling）
  //     const llmResponse = await this.llmService.generate(messages, {
  //       enableToolCalling: true,
  //     });

  //     // 5. 保存用户消息
  //     await this.prisma.chatMessage.create({
  //       data: {
  //         sessionId: session.id,
  //         role: 'user',
  //         content: question,
  //       },
  //     });

  //     // Transform tool results to match RetrievalResult structure for database storage
  //     const referencesForDB = llmResponse.toolCalls
  //       ? llmResponse.toolCalls.flatMap(tc =>
  //           tc.toolResult.results.map(result => ({
  //             chunkId: result.index.toString(), // Using index as chunkId
  //             documentId: result.source || '',  // Using source as documentId
  //             content: result.content,
  //             score: result.score,
  //             metadata: { source: result.source }
  //           }))
  //         )
  //       : [];

  //     // 6. 保存助手消息（包含 tool calling 元数据）
  //     await this.prisma.chatMessage.create({
  //       data: {
  //         sessionId: session.id,
  //         role: 'assistant',
  //         content: llmResponse.content,
  //         toolCalls: llmResponse.toolCalls ? { toJSON: () => llmResponse.toolCalls } as any : undefined,
  //         references: referencesForDB.length > 0 ? { toJSON: () => referencesForDB } as any : undefined,
  //         latencyMs: Date.now() - startTime,
  //         tokensUsed: llmResponse.usage.total_tokens,
  //       },
  //     });

  //     this.logger.debug(
  //       `Chat completed in ${Date.now() - startTime}ms, tokens: ${llmResponse.usage.total_tokens}, toolCalls: ${llmResponse.toolCalls?.length || 0}`
  //     );

  //     // 7. 记录检索日志（如果有 tool calling）
  //     if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
  //       await this.prisma.retrievalLog.create({
  //         data: {
  //           question,
  //           retrievedDocs: llmResponse.toolCalls.flatMap(tc =>
  //             tc.toolResult.results.map(r => ({
  //               chunkId: r.index.toString(), // Using index as chunkId
  //               documentId: r.source || '',  // Using source as documentId
  //               score: r.score,
  //             }))
  //           ),
  //           latencyMs: Date.now() - startTime,
  //           userId,
  //         },
  //       });
  //     }

  //     // Transform tool results to match RetrievalResult structure
  //     const references = llmResponse.toolCalls
  //       ? llmResponse.toolCalls.flatMap(tc =>
  //           tc.toolResult.results.map(result => ({
  //             chunkId: result.index.toString(), // Using index as chunkId
  //             documentId: result.source || '',  // Using source as documentId
  //             content: result.content,
  //             score: result.score,
  //             metadata: { source: result.source }
  //           }))
  //         )
  //       : [];

  //     // Build citations for frontend display
  //     const citations: Citation[] = references.map((r, idx) => ({
  //       index: idx + 1,
  //       chunkId: r.chunkId,
  //       documentId: r.documentId,
  //       content: r.content,
  //       source: (r.metadata?.source as string) || '未知文档',
  //       score: r.score,
  //     }));

  //     // Build thinking info
  //     const thinking: ThinkingInfo = llmResponse.toolCalls && llmResponse.toolCalls.length > 0
  //       ? {
  //           usedToolCalling: true,
  //           searchQuery: llmResponse.toolCalls[0]?.toolArgs?.query || question,
  //           resultCount: references.length,
  //           topScore: references.length > 0 ? references[0].score : 0,
  //         }
  //       : {
  //           usedToolCalling: false,
  //           message: '基于通用知识回答',
  //         };

  //     return {
  //       answer: llmResponse.content,
  //       sessionId: session.id,
  //       references,
  //       citations,
  //       thinking,
  //       usage: llmResponse.usage,
  //     };
  //   } catch (error) {
  //     this.logger.error(`Chat failed: ${error.message}`);
  //     throw error;
  //   }
  // }

  /**
   * 流式聊天（UI Message Stream）
   */
  async chatStream(
    request: ChatRequest,
    userId: string,
  ): Promise<AsyncIterableStream<InferUIMessageChunk<UIMessage>>> {
    const { messages, knowledgeBaseId, sessionId } = request;
    const startTime = Date.now();

    const modelMessages = await convertToModelMessages(messages as any);

    try {
      // 1. 创建/获取会话
      let session = sessionId
        ? await this.prisma.chatSession.findUnique({
            where: { id: sessionId },
          })
        : null;

      // if (!session) {
      //   session = await this.prisma.chatSession.create({
      //     data: {
      //       userId,
      //       knowledgeBaseId,
      //       title: (question as string).substring(0, 50),
      //     },
      //   });
      //   this.logger.debug(`Created new session: ${session.id}`);
      // }

      // 2. 获取历史消息
      // const history = await this.getChatHistory(session.id);

      // 3. 构建消息
      const messages: ChatMessage[] = [
        ...this.llmService.buildToolCallingPrompt(),
        ...modelMessages
      ];

      // 4. 保存用户消息
      // await this.prisma.chatMessage.create({
      //   data: {
      //     sessionId: session.id,
      //     role: 'user',
      //     content: question,
      //   },
      // });

      // 5. 调用 LLM 流式生成（SDK 自动处理工具调用）
      const response = await this.llmService.generateStream(messages, {
        enableToolCalling: true,
      });

      // if (!response.body) {
      //   throw new Error('Response body is null');
      // }

      // 6. 异步保存助手消息（流式结束后）
      // this.saveAssistantMessage(response.clone(), session.id, startTime).catch(
      //   (err) => {
      //     this.logger.error('Failed to save assistant message:', err);
      //   },
      // );

      return response;
    } catch (error) {
      this.logger.error(`Chat stream failed: ${error.message}`);
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
      const response = await this.llmService.generateStream(messages, {
        temperature,
        maxTokens,
      });

      // Conve
      return response
    } catch (error) {
      this.logger.error(
        `OpenAI streaming chat completion failed: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * 异步保存助手消息
   */
  private async saveAssistantMessage(
    response: Response,
    sessionId: string,
    startTime: number,
  ): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) {
      this.logger.error('Response body is not readable');
      return;
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let toolInvocations: any[] = [];
    let usage = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.content) fullContent += data.content;
              if (data.toolInvocations) toolInvocations = data.toolInvocations;
              if (data.usage) usage = data.usage;
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      // 提取 citations
      const citations = this.extractCitations(toolInvocations);

      let tokensUsed = 0;
      if (usage && typeof usage === 'object') {
        // Type assertion to handle the different possible structures
        const usageObj: any = usage;
        tokensUsed = (usageObj.total_tokens || usageObj.totalTokens || 0) as number;
      }

      // 保存到数据库
      await this.prisma.chatMessage.create({
        data: {
          sessionId,
          role: 'assistant',
          content: fullContent,
          toolCalls:
            toolInvocations.length > 0
              ? ({ toJSON: () => toolInvocations } as any)
              : undefined,
          references:
            citations.length > 0
              ? ({ toJSON: () => citations } as any)
              : undefined,
          latencyMs: Date.now() - startTime,
          tokensUsed,
        },
      });

      this.logger.debug(`Saved assistant message for session ${sessionId}`);
    } catch (error) {
      this.logger.error('Error reading stream:', error);
    } finally {
      try {
        await reader.cancel();
      } catch (e) {
        // Ignore cancel errors
      }
    }
  }

  /**
   * 从工具调用记录中提取 citations
   */
  private extractCitations(toolInvocations: any[]): any[] {
    return toolInvocations
      .filter(
        (inv) =>
          inv.toolName === 'knowledge_base_search' &&
          inv.result?.results &&
          Array.isArray(inv.result.results),
      )
      .flatMap((inv) =>
        inv.result.results.map((r: any, idx: number) => ({
          index: idx + 1,
          chunkId: r.index?.toString() || '',
          documentId: r.source || '',
          content: r.content || '',
          source: r.source || '未知文档',
          score: r.score || 0,
        })),
      );
  }
}