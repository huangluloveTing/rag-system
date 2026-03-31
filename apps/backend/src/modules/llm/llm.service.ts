/**
 * LLM 服务
 * 使用 Vercel AI SDK 集成通义千问 API（兼容 OpenAI）
 */

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createOpenAI } from "@ai-sdk/openai";
import { AsyncIterableStream, generateText, InferUIMessageChunk, ModelMessage, stepCountIs, streamText, Tool, ToolSet, UIMessage } from "ai";
import { z } from "zod";
import { RetrievalService } from "../retrieval/retrieval.service";

export type ChatMessage = ModelMessage

export interface ToolResult {
  status: "success" | "no_results" | "error";
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

  constructor(
    private configService: ConfigService,
    private retrievalService: RetrievalService,
  ) {
    const apiKey = this.configService.get<string>(
      "LLM_API_KEY",
      "sk-your-api-key-here",
    );
    this.model = this.configService.get<string>(
      "LLM_MODEL",
      "qwen/qwen3.5-plus",
    );
    const baseUrl = this.configService.get<string>(
      "LLM_BASE_URL",
      "https://dashscope.aliyuncs.com/compatible-mode/v1",
    );

    // 创建兼容 OpenAI 的 provider
    this.openai = createOpenAI({
      apiKey,
      baseURL: baseUrl,
    });

    this.logger.log(`LLM Service initialized with model: ${this.model}`);
  }

  getKnowledgeBaseSearchTool(): ToolSet {
    return {
      knowledge_base_search: {
        description: `
搜索知识库以获取与用户问题相关的文档内容。

适用场景：
- 用户询问特定领域的专业知识、技术细节
- 涉及公司政策、流程规范、产品特性等
- 需要引用文档来源、数据支持的问题

不适用场景：
- 简单问候、闲聊
- 通用常识问题
- 明确要求不使用知识库的问题
- 总结归纳后的回答（如“请基于知识库内容总结公司的报销流程”）
`,
        inputSchema: z.object({
          query: z
            .string()
            .describe("搜索查询文本，建议提取问题的关键词或核心表述"),
          topK: z
            .number()
            .min(1)
            .max(10)
            .default(5)
            .describe("返回结果数量，建议 3-5"),
          similarityThreshold: z
            .number()
            .min(0)
            .max(1)
            .default(0.3)
            .describe("相似度阈值，建议 0.3-0.5，越高要求越严格"),
        }) as any, // 类型断言以避免 Zod 类型过深问题

        execute: async ({
          query,
          topK,
          similarityThreshold,
        }: {
          query: string;
          topK: number;
          similarityThreshold: number;
        }): Promise<ToolResult> => {
          return await this.executeKnowledgeBaseSearch(
            query,
            topK,
            similarityThreshold,
          );
        },
      },
    };
  }

  private async executeKnowledgeBaseSearch(
    query: string,
    topK: number,
    similarityThreshold: number,
  ): Promise<ToolResult> {
    try {
      this.logger.debug(
        `Tool execution: searching knowledge base for "${query}"`,
      );

      const results = await this.retrievalService.retrieve(query, {
        topK,
        similarityThreshold,
        enableRerank: true,
        knowledgeBaseId: undefined,
      });

      if (results.length === 0) {
        this.logger.warn("Tool execution: no results found");
        return {
          status: "no_results",
          message: "知识库中没有找到相关信息。",
          results: [],
        };
      }

      this.logger.debug(`Tool execution: found ${results.length} results`);

      return {
        status: "success",
        message: `找到 ${results.length} 条相关信息`,
        results: results.map((r, idx) => ({
          index: idx + 1,
          content: r.content,
          source: r.metadata?.document?.filename || "未知文档",
          score: r.score,
        })),
      };
    } catch (error) {
      this.logger.error(`Tool execution failed: ${error.message}`);
      return {
        status: "error",
        message: `知识库检索失败：${error.message}`,
        results: [],
      };
    }
  }

  buildToolCallingPrompt(): ChatMessage[] {
    return [
      {
        role: "system",
        content: `你是一个专业的知识库问答助手。

工作流程：
1. 当用户提问时，优先使用 knowledge_base_search 工具搜索知识库
2. 如果找到相关信息，基于检索结果准确回答，并注明来源
3. 如果知识库中没有相关信息，或用户问题不需要知识库（如问候、常识），可直接回答

回答原则：
- 准确：基于事实和数据，不编造信息
- 清晰：简洁有条理，避免冗余
- 来源透明：引用知识库内容时，在句末添加引用标记，格式为 [1]、[2]、[3] 等，按引用出现顺序编号
- 诚实：知识库无相关信息时，明确告知并说明原因

引用标记使用示例：
- "公司的报销流程需要提交发票和申请表 [1]。审批通常需要 3-5 个工作日 [2]。"
- 如果引用多个来源，分别标注："...需要提交发票 [1][2]。审批流程如下 [3]。"

注意：
- 只有在引用知识库内容时才添加引用标记
- 引用标记放在标点符号之前
- 每个引用标记对应一个具体的文档来源`,
      },
    ];
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
      enableToolCalling?: boolean;
    } = {},
  ): Promise<LLMResponse> {
    const {
      temperature = 0.7,
      topP = 0.9,
      enableToolCalling = false,
    } = options;

    try {
      this.logger.debug(
        `Generating response with model: ${this.model}, toolCalling: ${enableToolCalling}`,
      );

      const toolCalls: ToolCallLog[] = [];

      const result = await generateText({
        model: this.openai(this.model),
        messages,
        temperature,
        maxRetries: 3,
        tools: enableToolCalling
          ? this.getKnowledgeBaseSearchTool()
          : undefined,
        // maxSteps 和 onToolCall 暂时禁用，等待 SDK 更新
        // maxSteps: enableToolCalling ? 3 : 1,
        // onToolCall: enableToolCalling
        //   ? ({ toolCall, toolResult }) => {
        //       this.logger.debug(`Tool called: ${toolCall.toolName}`);
        //       toolCalls.push({
        //         toolName: toolCall.toolName,
        //         toolArgs: toolCall.args as any,
        //         toolResult: toolResult as ToolResult,
        //         timestamp: new Date(),
        //       });
        //     }
        //   : undefined,
      });

      const usage = result.usage as any;
      const promptTokens = usage?.promptTokens || usage?.prompt_tokens || 0;
      const completionTokens =
        usage?.completionTokens || usage?.completion_tokens || 0;
      const totalTokens = promptTokens + completionTokens;

      this.logger.debug(
        `Generated ${completionTokens} tokens, total: ${totalTokens}, toolCalls: ${toolCalls.length}`,
      );

      return {
        content: result.text,
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
        },
        model: this.model,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (error) {
      this.logger.error(`LLM generation failed: ${error.message}`);
      throw new Error(`LLM generation failed: ${error.message}`);
    }
  }

  /**
   * 流式生成文本
   * 返回 UI Message Stream Response
   */
  async generateStream(
    messages: ChatMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      enableToolCalling?: boolean;
    } = {},
  ): Promise<AsyncIterableStream<InferUIMessageChunk<UIMessage>>> {
    const {
      temperature = 0.7,
      maxTokens,
      topP = 0.9,
      enableToolCalling = false,
    } = options;

    try {
      this.logger.debug(
        `Starting stream generation, toolCalling: ${enableToolCalling}`,
      );

      const result = streamText({
        model: this.openai.chat(this.model),
        messages: [{ role: "system", content: "你是一个专业的知识库问答助手。工具调用的回答，需要通过大模型总结后，返回给用户！！！" }, ...messages],
        temperature,
        maxRetries: 3,
        stopWhen: stepCountIs(5),
        onChunk: (chunk) => {
          this.logger.debug(`Stream chunk: ${JSON.stringify(chunk)}`);
        },
        ...(maxTokens && { maxTokens }),
        ...(enableToolCalling ? { maxSteps: 5 } : {}), // Enable up to 5 tool calling steps when tool calling is enabled
        tools: enableToolCalling
          ? this.getKnowledgeBaseSearchTool()
          : undefined,
      });

      // Return standard UI Message Stream Response
      return  result.toUIMessageStream();
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
    systemPrompt?: string,
  ): ChatMessage[] {
    const defaultSystemPrompt = `你是一个专业的知识库问答助手。请基于提供的上下文信息回答用户问题。

要求：
1. 答案必须基于提供的上下文，不要编造信息
2. 如果上下文中没有相关信息，请明确告知用户
3. 回答要准确、简洁、有条理
4. 如果引用上下文内容，请注明来源`;

    const contextText = contexts
      .map((ctx, index) => `[文档${index + 1}]\n${ctx}`)
      .join("\n\n");

    const userPrompt = `上下文信息：
${contextText}

用户问题：${question}

请基于上述上下文信息回答问题：`;

    return [
      {
        role: "system",
        content: systemPrompt || defaultSystemPrompt,
      },
      {
        role: "user",
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
