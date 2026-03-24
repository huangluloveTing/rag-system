/**
 * LLM 服务
 * 集成通义千问 API，处理文本生成
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

export interface StreamChunk {
  delta: string;
  finish_reason: string | null;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>(
      'LLM_API_KEY',
      'sk-your-api-key-here'
    );
    this.model = this.configService.get<string>('LLM_MODEL', 'qwen3.5-plus');
    this.baseUrl = this.configService.get<string>(
      'LLM_BASE_URL',
      'https://dashscope.aliyuncs.com/compatible-mode/v1'
    );
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
    const { temperature = 0.7, maxTokens = 2000, topP = 0.9 } = options;

    try {
      this.logger.debug(`Generating response with model: ${this.model}`);

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature,
          max_tokens: maxTokens,
          top_p: topP,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 60000, // 60秒超时
        }
      );

      const choice = response.data.choices[0];
      const usage = response.data.usage;

      this.logger.debug(
        `Generated ${usage.completion_tokens} tokens, total: ${usage.total_tokens}`
      );

      return {
        content: choice.message.content,
        usage: {
          prompt_tokens: usage.prompt_tokens,
          completion_tokens: usage.completion_tokens,
          total_tokens: usage.total_tokens,
        },
        model: this.model,
      };
    } catch (error) {
      this.logger.error(`LLM generation failed: ${error.message}`);
      if (error.response) {
        this.logger.error(
          `API Error: ${JSON.stringify(error.response.data)}`
        );
      }
      throw new Error(`LLM generation failed: ${error.message}`);
    }
  }

  /**
   * 流式生成文本
   * 返回 AsyncGenerator
   */
  async *generateStream(
    messages: ChatMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
    } = {}
  ): AsyncGenerator<StreamChunk> {
    const { temperature = 0.7, maxTokens = 2000, topP = 0.9 } = options;

    try {
      this.logger.debug(`Starting stream generation with model: ${this.model}`);

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature,
          max_tokens: maxTokens,
          top_p: topP,
          stream: true,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          responseType: 'stream',
          timeout: 120000, // 2分钟超时
        }
      );

      // 处理流式响应
      const stream = response.data;
      let buffer = '';

      for await (const chunk of stream) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后一个不完整的行

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
          if (!trimmedLine.startsWith('data: ')) continue;

          try {
            const jsonStr = trimmedLine.slice(6); // 移除 'data: '
            const data = JSON.parse(jsonStr);

            const delta = data.choices[0]?.delta?.content || '';
            const finishReason = data.choices[0]?.finish_reason || null;

            if (delta) {
              yield {
                delta,
                finish_reason: finishReason,
              };
            }
          } catch (parseError) {
            this.logger.warn(
              `Failed to parse stream chunk: ${parseError.message}`
            );
          }
        }
      }

      this.logger.debug('Stream generation completed');
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