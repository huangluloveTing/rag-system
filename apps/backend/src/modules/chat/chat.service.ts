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
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private retrievalService: RetrievalService,
    private llmService: LlmService,
    private configService: ConfigService
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

      // 2. 检索相关文档
      const retrievalResults = await this.retrievalService.retrieve(question, {
        knowledgeBaseId: session.knowledgeBaseId || undefined,
      });

      this.logger.debug(`Retrieved ${retrievalResults.length} documents`);

      // 3. 构建上下文
      const contexts = retrievalResults.map((r) => r.content);

      // 4. 获取历史消息
      const history = await this.getChatHistory(session.id);

      // 5. 构建 Prompt
      const messages: ChatMessage[] = [
        ...history.slice(-6), // 保留最近 3 轮对话
        ...this.llmService.buildRAGPrompt(question, contexts),
      ];

      // 6. 调用 LLM 生成答案
      const llmResponse = await this.llmService.generate(messages);

      // 7. 保存用户消息
      await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'user',
          content: question,
        },
      });

      // 8. 保存助手消息
      const assistantMessage = await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          content: llmResponse.content,
          references: retrievalResults.map((r) => ({
            chunkId: r.chunkId,
            documentId: r.documentId,
            content: r.content.substring(0, 200), // 只保存前 200 字符
            score: r.score,
          })),
          latencyMs: Date.now() - startTime,
          tokensUsed: llmResponse.usage.total_tokens,
        },
      });

      this.logger.debug(
        `Chat completed in ${Date.now() - startTime}ms, tokens: ${llmResponse.usage.total_tokens}`
      );

      // 9. 记录检索日志
      await this.prisma.retrievalLog.create({
        data: {
          question,
          retrievedDocs: retrievalResults.map((r) => ({
            chunkId: r.chunkId,
            documentId: r.documentId,
            score: r.score,
          })),
          latencyMs: Date.now() - startTime,
          userId,
        },
      });

      return {
        answer: llmResponse.content,
        sessionId: session.id,
        references: retrievalResults,
        usage: llmResponse.usage,
      };
    } catch (error) {
      this.logger.error(`Chat failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 流式聊天
   * 返回 AsyncGenerator
   */
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

      // 2. 检索文档
      const retrievalResults = await this.retrievalService.retrieve(question, {
        knowledgeBaseId: session.knowledgeBaseId || undefined,
      });

      // 3. 构建上下文
      const contexts = retrievalResults.map((r) => r.content);

      // 4. 获取历史
      const history = await this.getChatHistory(session.id);

      // 5. 构建 Prompt
      const messages: ChatMessage[] = [
        ...history.slice(-6),
        ...this.llmService.buildRAGPrompt(question, contexts),
      ];

      // 6. 保存用户消息
      await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'user',
          content: question,
        },
      });

      // 7. 流式生成答案
      let fullContent = '';
      for await (const chunk of this.llmService.generateStream(messages)) {
        fullContent += chunk.delta;
        yield chunk.delta;
      }

      // 8. 保存助手消息
      await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          content: fullContent,
          references: retrievalResults.map((r) => ({
            chunkId: r.chunkId,
            documentId: r.documentId,
            content: r.content.substring(0, 200),
            score: r.score,
          })),
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
}