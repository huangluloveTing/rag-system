/**
 * LLM 服务
 * 使用 Vercel AI SDK 集成通义千问 API（兼容 OpenAI）
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import { z } from 'zod';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ToolResult {
  status: 'success' | 'no_results' | 'error';
  message: string;
  results: Array<{
    index: number;
    content: string;
    source: string;
    score: number;
  }>;
}

export interface ToolCallLog {
  toolName: string;
  toolArgs: {
    query: string;
    topK: number;
    similarityThreshold: number;
  };
  toolResult: ToolResult;
  timestamp: Date;
}

export interface LLMResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  toolCalls?: ToolCallLog[];
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly model: string;
  private readonly openai: ReturnType<typeof createOpenAI>;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>(
      'LLM_API_KEY',
      'sk-your-api-key-here'
    );
    this.model = this.configService.get<string>('LLM_MODEL', 'qwen/qwen3.5-plus');
    const baseUrl = this.configService.get<string>(
      'LLM_BASE_URL',
      'https://dashscope.aliyuncs.com/compatible-mode/v1'
    );

    // 创建兼容 OpenAI 的 provider
    this.openai = createOpenAI({
      apiKey,
      baseURL: baseUrl,
    });

    this.logger.log(`LLM Service initialized with model: ${this.model}`);
  }

  /**
   * 生成文本（非流式）
   */
  async generate(
    messages: ChatMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
    } = {}
  ): Promise<LLMResponse> {
    const { temperature = 0.7, topP = 0.9 } = options;

    try {
      this.logger.debug(`Generating response with model: ${this.model}`);

      const result = await generateText({
        model: this.openai(this.model),
        messages,
        temperature,
        maxRetries: 3,
      });

      // 获取 token 使用情况
      const usage = result.usage as any;
      const promptTokens = usage?.promptTokens || usage?.prompt_tokens || 0;
      const completionTokens = usage?.completionTokens || usage?.completion_tokens || 0;
      const totalTokens = promptTokens + completionTokens;

      this.logger.debug(
        `Generated ${completionTokens} tokens, total: ${totalTokens}`
      );

      return {
        content: result.text,
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
        },
        model: this.model,
      };
    } catch (error) {
      this.logger.error(`LLM generation failed: ${error.message}`);
      throw new Error(`LLM generation failed: ${error.message}`);
    }
  }

  /**
   * 流式生成文本
   * 返回 AsyncIterableStream
   */
  async generateStream(
    messages: ChatMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
    } = {}
  ) {
    const { temperature = 0.7, topP = 0.9 } = options;

    try {
      this.logger.debug(`Starting stream generation with model: ${this.model}`);

      const result = streamText({
        model: this.openai(this.model),
        messages,
        temperature,
        maxRetries: 3,
      });

      return result.textStream;
    } catch (error) {
      this.logger.error(`Stream generation failed: ${error.message}`);
      throw new Error(`Stream generation failed: ${error.message}`);
    }
  }

  /**
   * 构建 RAG Prompt
   */
  buildRAGPrompt(
    question: string,
    contexts: string[],
    systemPrompt?: string
  ): ChatMessage[] {
    const defaultSystemPrompt = `你是一个专业的知识库问答助手。请基于提供的上下文信息回答用户问题。

要求：
1. 答案必须基于提供的上下文，不要编造信息
2. 如果上下文中没有相关信息，请明确告知用户
3. 回答要准确、简洁、有条理
4. 如果引用上下文内容，请注明来源`;

    const contextText = contexts
      .map((ctx, index) => `[文档${index + 1}]\n${ctx}`)
      .join('\n\n');

    const userPrompt = `上下文信息：
${contextText}

用户问题：${question}

请基于上述上下文信息回答问题：`;

    return [
      {
        role: 'system',
        content: systemPrompt || defaultSystemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ];
  }

  /**
   * 计算文本 Token 数（估算）
   */
  estimateTokens(text: string): number {
    // 简单估算：中文约 1.5 字符/token，英文约 4 字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }
}