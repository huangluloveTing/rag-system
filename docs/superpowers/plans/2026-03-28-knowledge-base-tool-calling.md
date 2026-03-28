# Knowledge Base Tool Calling 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现基于 Tool Calling 的智能知识库检索功能，让 LLM 自动判断是否需要检索知识库

**Architecture:** 使用 Vercel AI SDK 的 tools 参数定义 `knowledge_base_search` tool，在 LlmService 中封装 tool schema 和 execution logic，ChatService 移除手动检索改用 tool calling 模式，实现自动化的检索决策和执行

**Tech Stack:** Vercel AI SDK (`generateText`, `streamText` + `tools`), Zod (tool parameters schema), NestJS, Prisma

---

## File Structure

### Modified Files
- `apps/backend/prisma/schema.prisma` - 添加 `toolCalls` 字段到 ChatMessage 模型
- `apps/backend/src/modules/llm/llm.service.ts` - 定义 tool schema、添加 tool calling 支持
- `apps/backend/src/modules/chat/chat.service.ts` - 移除手动检索，使用 tool calling 模式

### Created Files
- `apps/backend/src/modules/llm/llm.service.spec.ts` - LlmService tool calling 单元测试
- `apps/backend/src/modules/chat/chat.service.spec.ts` - ChatService tool calling 单元测试

### Test Files
- `apps/backend/src/modules/llm/llm.service.spec.ts`
- `apps/backend/src/modules/chat/chat.service.spec.ts`

---

## Task 1: 更新 Prisma Schema 添加 toolCalls 字段

**Files:**
- Modify: `apps/backend/prisma/schema.prisma:145-162`

- [ ] **Step 1: 添加 toolCalls 字段到 ChatMessage 模型**

在 ChatMessage 模型中添加 `toolCalls` 字段：

```prisma
// 对话消息表
model ChatMessage {
  id         String   @id @default(uuid()) @db.Uuid
  role       String   @db.VarChar(20) // user/assistant
  content    String
  references Json?    // 引用的文档片段
  toolCalls  Json?    // Tool calling 记录（新增）
  latencyMs  Int?
  tokensUsed Int?
  createdAt  DateTime @default(now())

  sessionId  String @db.Uuid
  session    ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  feedbacks  Feedback[]

  @@index([sessionId])
  @@index([createdAt])
  @@map("chat_messages")
}
```

在 line 152 之后添加 `toolCalls Json?` 字段。

- [ ] **Step 2: 生成 Prisma migration**

```bash
cd apps/backend
pnpm prisma migrate dev --name add_tool_calls_field
```

Expected: Migration 文件生成并应用成功

- [ ] **Step 3: 验证数据库更新**

```bash
pnpm prisma studio
```

打开 Prisma Studio，确认 ChatMessage 表新增了 `toolCalls` 字段（JSON 类型，可选）

- [ ] **Step 4: Commit Schema 变更**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations/
git commit -m "feat(db): add toolCalls field to ChatMessage model"
```

---

## Task 2: 修改 LlmService - 定义 Tool Schema 和 Types

**Files:**
- Modify: `apps/backend/src/modules/llm/llm.service.ts:1-179`

- [ ] **Step 1: 添加必要的 imports**

在文件顶部添加 Zod import：

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import { z } from 'zod';  // 新增
```

在 line 10 之后添加 `import { z } from 'zod';`。

- [ ] **Step 2: 定义 ToolCallLog interface**

在 ChatMessage interface 之后添加 ToolCallLog interface：

```typescript
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// 新增：Tool calling 日志结构
export interface ToolCallLog {
  toolName: string;
  toolArgs: {
    query: string;
    topK: number;
    similarityThreshold: number;
  };
  toolResult: {
    status: string;
    message: string;
    results: any[];
  };
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
}
```

在 line 14-16 之后添加 ToolCallLog interface 定义。

- [ ] **Step 3: 定义 tool result interface**

添加 ToolResult interface：

```typescript
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

// 新增：Tool execution 结果结构
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

export interface LLMResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}
```

在 ToolCallLog 之后添加 ToolResult interface。

- [ ] **Step 4: 更新 LLMResponse interface 以支持 tool calling**

修改 LLMResponse interface 添加 toolCalls 字段：

```typescript
export interface LLMResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  toolCalls?: ToolCallLog[];  // 新增：tool calling 记录
}
```

在 line 23-25 之后添加 `toolCalls?: ToolCallLog[];` 字段。

- [ ] **Step 5: Commit interface 和 import 变更**

```bash
git add apps/backend/src/modules/llm/llm.service.ts
git commit -m "feat(llm): add tool calling interfaces and types"
```

---

## Task 3: 修改 LlmService - 实现 Tool Definition 和 Execution

**Files:**
- Modify: `apps/backend/src/modules/llm/llm.service.ts:27-179`

- [ ] **Step 1: 添加 RetrievalService dependency injection**

修改 constructor 添加 RetrievalService：

```typescript
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly model: string;
  private readonly openai: ReturnType<typeof createOpenAI>;

  constructor(
    private configService: ConfigService,
    private retrievalService: RetrievalService  // 新增
  ) {
    const apiKey = this.configService.get<string>(
      'LLM_API_KEY',
      'sk-your-api-key-here'
    );
    this.model = this.configService.get<string>('LLM_MODEL', 'qwen/qwen3.5-plus');
    const baseUrl = this.configService.get<string>(
      'LLM_BASE_URL',
      'https://dashscope.aliyuncs.com/compatible-mode/v1'
    );

    this.openai = createOpenAI({
      apiKey,
      baseURL: baseUrl,
    });

    this.logger.log(`LLM Service initialized with model: ${this.model}`);
  }
```

在 line 32 constructor 参数中添加 `private retrievalService: RetrievalService`。

需要添加 import：

```typescript
import { RetrievalService } from '../retrieval/retrieval.service';
```

在文件顶部 imports 中添加。

- [ ] **Step 2: 定义 knowledge_base_search tool**

在 class 内添加 tool definition 方法：

```typescript
  /**
   * 定义 knowledge_base_search tool
   */
  getKnowledgeBaseSearchTool() {
    return {
      knowledge_base_search: {
        description: `搜索知识库以获取与用户问题相关的文档内容。

适用场景：
- 用户询问特定领域的专业知识、技术细节
- 涉及公司政策、流程规范、产品��性等
- 需要引用文档来源、数据支持的问题

不适用场景：
- 简单问候、闲聊
- 通用常识问题
- 明确要求不使用知识库的问题`,

        parameters: z.object({
          query: z.string().describe('搜索查询文本，建议提取问题的关键词或核心表述'),
          topK: z.number().min(1).max(10).default(5).describe('返回结果数量，建议 3-5'),
          similarityThreshold: z.number().min(0).max(1).default(0.3).describe('相似度阈值，建议 0.3-0.5，越高要求越严格'),
        }),

        execute: async ({ query, topK, similarityThreshold }: {
          query: string;
          topK: number;
          similarityThreshold: number;
        }): Promise<ToolResult> => {
          return await this.executeKnowledgeBaseSearch(query, topK, similarityThreshold);
        },
      },
    };
  }
```

在 line 50 之后添加此方法。

- [ ] **Step 3: 实现 tool execution logic**

添加 executeKnowledgeBaseSearch 方法：

```typescript
  /**
   * 执行知识库检索
   */
  private async executeKnowledgeBaseSearch(
    query: string,
    topK: number,
    similarityThreshold: number
  ): Promise<ToolResult> {
    try {
      this.logger.debug(`Tool execution: searching knowledge base for "${query}"`);

      const results = await this.retrievalService.retrieve(query, {
        topK,
        similarityThreshold,
        enableRerank: true,
        knowledgeBaseId: undefined, // 搜索所有知识库
      });

      if (results.length === 0) {
        this.logger.warn('Tool execution: no results found');
        return {
          status: 'no_results',
          message: '知识库中没有找到相关信息。',
          results: [],
        };
      }

      this.logger.debug(`Tool execution: found ${results.length} results`);

      return {
        status: 'success',
        message: `找到 ${results.length} 条相关信息`,
        results: results.map((r, idx) => ({
          index: idx + 1,
          content: r.content,
          source: r.metadata?.document?.filename || '未知文档',
          score: r.score,
        })),
      };
    } catch (error) {
      this.logger.error(`Tool execution failed: ${error.message}`);
      return {
        status: 'error',
        message: `知识库检索失败：${error.message}`,
        results: [],
      };
    }
  }
```

在 `getKnowledgeBaseSearchTool()` 方法之后添加。

- [ ] **Step 4: 实现 buildToolCallingPrompt 方法**

添加 system prompt 构建方法：

```typescript
  /**
   * 构建 Tool Calling 模式的 System Prompt
   */
  buildToolCallingPrompt(): ChatMessage[] {
    return [
      {
        role: 'system',
        content: `你是一个专业的知识库问答助手。

工作流程：
1. 当用户提问时，优先使用 knowledge_base_search 工具搜索知识库
2. 如果找到相关信息，基于检索结果准确回答，并注明来源
3. 如果知识库中没有相关信息，或用户问题不需要知识库（如问候、常识），可直接回答

回答原则：
- 准确：基于事实和数据，不编造信息
- 清晰：简洁有条理，避免冗余
- 来源透明：引用知识库内容时注明来源
- 诚实：知识库无相关信息时，明确告知并说明原因`,
      },
    ];
  }
```

在 `executeKnowledgeBaseSearch()` 方法之后添加。

- [ ] **Step 5: Commit tool definition 和 execution**

```bash
git add apps/backend/src/modules/llm/llm.service.ts apps/backend/src/modules/chat/chat.module.ts
git commit -m "feat(llm): implement knowledge_base_search tool definition and execution"
```

需要先更新 chat.module.ts 以注入 RetrievalService 到 LlmService。

---

## Task 4: 更新 ChatModule 依赖注入

**Files:**
- Modify: `apps/backend/src/modules/chat/chat.module.ts:1-50`

- [ ] **Step 1: 在 ChatModule 中添加 RetrievalService 到 LlmService 的依赖**

修改 chat.module.ts：

```typescript
import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [
    PrismaModule,
    RetrievalModule,  // 确保 RetrievalModule 已导入
    LlmModule,        // 确保 LlmModule 已导入
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
```

确保 imports 中包含 RetrievalModule 和 LlmModule。

还需要修改 LlmModule 以导出 LlmService 并导入 RetrievalModule。

- [ ] **Step 2: 更新 LlmModule imports**

读取并修改 `apps/backend/src/modules/llm/llm.module.ts`：

```typescript
import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { RetrievalModule } from '../retrieval/retrieval.module';  // 新增

@Module({
  imports: [RetrievalModule],  // 新增：导入 RetrievalModule
  providers: [LlmService],
  exports: [LlmService],  // 确保 LlmService 已导出
})
export class LlmModule {}
```

添加 RetrievalModule import 并确保 LlmService 已导出。

- [ ] **Step 3: Commit module 更新**

```bash
git add apps/backend/src/modules/chat/chat.module.ts apps/backend/src/modules/llm/llm.module.ts
git commit -m "feat(modules): add RetrievalService dependency to LlmService"
```

---

## Task 5: 修改 LlmService - 添加 Tool Calling 支持

**Files:**
- Modify: `apps/backend/src/modules/llm/llm.service.ts:55-98`

- [ ] **Step 1: 更新 generate 方法支持 tools**

修改 generate 方法添加 tools 和 onToolCall 参数：

```typescript
  /**
   * 生成文本（非流式）- 支持 Tool Calling
   */
  async generate(
    messages: ChatMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      enableToolCalling?: boolean;  // 新增：是否启用 tool calling
    } = {}
  ): Promise<LLMResponse> {
    const { temperature = 0.7, topP = 0.9, enableToolCalling = false } = options;

    try {
      this.logger.debug(`Generating response with model: ${this.model}, toolCalling: ${enableToolCalling}`);

      const toolCalls: ToolCallLog[] = [];

      const result = await generateText({
        model: this.openai(this.model),
        messages,
        temperature,
        maxRetries: 3,
        tools: enableToolCalling ? this.getKnowledgeBaseSearchTool() : undefined,
        maxSteps: enableToolCalling ? 3 : 1,
        onToolCall: enableToolCalling
          ? ({ toolCall, toolResult }) => {
              this.logger.debug(`Tool called: ${toolCall.toolName}`);
              toolCalls.push({
                toolName: toolCall.toolName,
                toolArgs: toolCall.args as any,
                toolResult: toolResult as ToolResult,
                timestamp: new Date(),
              });
            }
          : undefined,
      });

      // 获取 token 使用情况
      const usage = result.usage as any;
      const promptTokens = usage?.promptTokens || usage?.prompt_tokens || 0;
      const completionTokens = usage?.completionTokens || usage?.completion_tokens || 0;
      const totalTokens = promptTokens + completionTokens;

      this.logger.debug(
        `Generated ${completionTokens} tokens, total: ${totalTokens}, toolCalls: ${toolCalls.length}`
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
```

完全替换原有的 generate 方法（line 55-98）。

- [ ] **Step 2: 更新 generateStream 方法支持 tools**

修改 generateStream 方法：

```typescript
  /**
   * 流式生成文本 - 支持 Tool Calling
   * 返回 AsyncIterableStream
   */
  async generateStream(
    messages: ChatMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      enableToolCalling?: boolean;  // 新增：是否启用 tool calling
    } = {}
  ) {
    const { temperature = 0.7, topP = 0.9, enableToolCalling = false } = options;

    try {
      this.logger.debug(`Starting stream generation, toolCalling: ${enableToolCalling}`);

      const result = streamText({
        model: this.openai(this.model),
        messages,
        temperature,
        maxRetries: 3,
        tools: enableToolCalling ? this.getKnowledgeBaseSearchTool() : undefined,
        maxSteps: enableToolCalling ? 3 : 1,
      });

      return result.textStream;
    } catch (error) {
      this.logger.error(`Stream generation failed: ${error.message}`);
      throw new Error(`Stream generation failed: ${error.message}`);
    }
  }
```

完全替换原有的 generateStream 方法（line 103-129）。

注意：流式模式下无法使用 onToolCall callback，tool calling 在后台自动执行。

- [ ] **Step 3: Commit LlmService tool calling 支持**

```bash
git add apps/backend/src/modules/llm/llm.service.ts
git commit -m "feat(llm): add tool calling support to generate and generateStream methods"
```

---

## Task 6: 修改 ChatService - 移除手动检索逻辑

**Files:**
- Modify: `apps/backend/src/modules/chat/chat.service.ts:79-184`

- [ ] **Step 1: 移除 chat 方法中的手动检索代码**

修改 chat 方法，移除注释掉的检索逻辑：

```typescript
  /**
   * 处理聊天请求（非流式）- 使用 Tool Calling
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
        ...history.slice(-6),  // 保留最近 6 条历史
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

      // 6. 保存助手消息（包含 tool calling 元数据）
      await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          content: llmResponse.content,
          toolCalls: llmResponse.toolCalls || null,
          references: llmResponse.toolCalls
            ? llmResponse.toolCalls.flatMap(tc => tc.toolResult.results || [])
            : null,
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
                chunkId: r.index,
                score: r.score,
              }))
            ),
            latencyMs: Date.now() - startTime,
            userId,
          },
        });
      }

      return {
        answer: llmResponse.content,
        sessionId: session.id,
        references: llmResponse.toolCalls?.flatMap(tc => tc.toolResult.results || []) || [],
        usage: llmResponse.usage,
      };
    } catch (error) {
      this.logger.error(`Chat failed: ${error.message}`);
      throw error;
    }
  }
```

完全替换原有的 chat 方法（line 79-184）。

- [ ] **Step 2: Commit chat 方法改造**

```bash
git add apps/backend/src/modules/chat/chat.service.ts
git commit -m "feat(chat): remove manual retrieval and use tool calling in chat method"
```

---

## Task 7: 修改 ChatService - 更新流式聊天方法

**Files:**
- Modify: `apps/backend/src/modules/chat/chat.service.ts:186-273`

- [ ] **Step 1: 更新 chatStream 方法**

修改 chatStream 方法使用 tool calling：

```typescript
  /**
   * 流式聊天 - 使用 Tool Calling
   * 返回 AsyncIterable<string>
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

      // 2. 获取历史消息
      const history = await this.getChatHistory(session.id);

      // 3. 构建 Prompt（使用 Tool Calling System Prompt）
      const messages: ChatMessage[] = [
        ...this.llmService.buildToolCallingPrompt(),
        ...history.slice(-6),
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
          toolCalls: null,  // 流式模式暂时无法记录 tool calls
          references: null,
          latencyMs: Date.now() - startTime,
        },
      });

      this.logger.debug(`Streaming chat completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      this.logger.error(`Streaming chat failed: ${error.message}`);
      throw error;
    }
  }
```

完全替换原有的 chatStream 方法（line 186-273）。

注意：流式模式下 Vercel AI SDK 不提供 tool calling 元数据回调，暂时无法记录。

- [ ] **Step 2: Commit chatStream 方法更新**

```bash
git add apps/backend/src/modules/chat/chat.service.ts
git commit -m "feat(chat): update chatStream to use tool calling mode"
```

---

## Task 8: 手动测试验证 - 知识库相关问题

**Files:**
- Manual testing via API

- [ ] **Step 1: 启动开发环境**

```bash
pnpm docker:infra  # 启动基础设施
pnpm dev:backend   # 启动后端服务
pnpm dev:embedding # 启动 embedding 服务
```

Expected: 所有服务正常运行

- [ ] **Step 2: 创建测试知识库和文档**

使用现有的 API 或 Prisma Studio：
1. 创建一个知识库
2. 上传测试文档（如：员工手册，包含报销流程等内容）
3. 等待文档处理完成（状态变为 indexed）

- [ ] **Step 3: 测试知识库相关问题**

使用 API 或 curl 发送请求：

```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "公司的报销流程是什么？",
    "knowledgeBaseId": "<your-knowledge-base-id>"
  }'
```

Expected:
- 返回答案包含报销流程内容
- 答案注明来源（文档名称）
- 检查数据库：ChatMessage.toolCalls 字段有记录
- 检查日志：有 "Tool called: knowledge_base_search" 输出

- [ ] **Step 4: 检查数据库记录**

```bash
pnpm db:studio
```

查看 ChatMessage 表：
- toolCalls 字段有 JSON 数据
- toolCalls 包含 toolName: "knowledge_base_search"
- toolResult.status: "success"
- toolResult.results 有检索到的文档片段

- [ ] **Step 5: 检查日志输出**

查看 backend 日志：
- 有 "Tool execution: searching knowledge base for..." 输出
- 有 "Tool execution: found X results" 输出
- 有 tool calling 的调用记录

---

## Task 9: 手动测试验证 - 常识性问题

**Files:**
- Manual testing via API

- [ ] **Step 1: 测试常识性问题**

```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "你好，请问什么是人工智能？"
  }'
```

Expected:
- 返回关于人工智能的答案
- 答案来自 LLM 内置知识，不引用文档
- 检查数据库：ChatMessage.toolCalls 字段为 null（LLM 决定不调用 tool）
- 检查日志：没有 tool calling 输出

- [ ] **Step 2: 检查数据库记录**

查看 ChatMessage 表：
- toolCalls 字段为 null
- LLM 直接回答，未使用检索

- [ ] **Step 3: 验证 Tool Calling 智能判断**

确认 LLM 能够正确判断：
- 知识库相关问题 → 调用 tool
- 常识性问题 → 不调用 tool
- 问候语 → 不调用 tool

---

## Task 10: 手动测试验证 - 知识库无结果

**Files:**
- Manual testing via API

- [ ] **Step 1: 测试知识库中不存在的问题**

```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "如何修理火星车？",
    "knowledgeBaseId": "<your-knowledge-base-id>"
  }'
```

Expected:
- LLM 调用 tool，但返回无结果
- toolResult.status: "no_results"
- 答案明确告知用户"知识库中没有相关信息"
- LLM 可能基于内置知识补充回答

- [ ] **Step 2: 检查数据库记录**

查看 ChatMessage 表：
- toolCalls 有记录（LLM 调用了 tool）
- toolResult.status: "no_results"
- toolResult.results: []

- [ ] **Step 3: 检查日志输出**

查看日志：
- 有 "Tool execution: searching knowledge base..." 输出
- 有 "Tool execution: no results found" 输出
- LLM 明确告知用户无相关信息

---

## Task 11: 手动测试验证 - 多轮对话

**Files:**
- Manual testing via API

- [ ] **Step 1: 测试第一轮对话**

```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "报销需要提交什么材料？",
    "knowledgeBaseId": "<your-knowledge-base-id>"
  }'
```

记录返回的 sessionId。

Expected:
- Tool 被调用
- 返回答案和 sessionId

- [ ] **Step 2: 测试第二轮对话（使用相同 sessionId）**

```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "提交后多久能审批完成？",
    "sessionId": "<session-id-from-step-1>"
  }'
```

Expected:
- Tool 再次被调用
- 历史消息正确传递
- 多轮对话上下文连贯

- [ ] **Step 3: 检查数据库历史消息**

查看 ChatMessage 表，确认：
- sessionId 正确
- 有多条消息（user + assistant）
- 历史消息正确保存

---

## Task 12: 手动测试验证 - 流式响应

**Files:**
- Manual testing via API

- [ ] **Step 1: 测试流式聊天**

```bash
curl -X POST http://localhost:3000/api/v1/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "question": "公司的请假制度是怎样的？",
    "knowledgeBaseId": "<your-knowledge-base-id>"
  }'
```

Expected:
- 流式输出答案（逐字输出）
- 输出流畅，无明显延迟
- Tool calling 在后台执行，用户无感知

- [ ] **Step 2: 验证流式体验**

确认：
- 响应是流式的（Server-Sent Events）
- 用户看到流畅的答案输出
- 没有 tool calling 的中间过程输出

---

## Task 13: 手动测试验证 - 检索服务异常

**Files:**
- Manual testing with service failure

- [ ] **Step 1: 停止 Embedding Service 模拟异常**

```bash
# 停止 embedding service
# 或者在 RetrievalService 中 mock 错误
```

- [ ] **Step 2: 测试异常场景**

```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "公司的报销流程是什么？",
    "knowledgeBaseId": "<your-knowledge-base-id>"
  }'
```

Expected:
- Tool execution 返回 error 状态
- 聊天功能不崩溃
- LLM 告知用户系统异常或基于内置知识回答
- 错误处理降级成功

- [ ] **Step 3: 检查日志错误处理**

查看日志：
- 有 "Tool execution failed" 输出
- toolResult.status: "error"
- LLM 正常降级处理

---

## Task 14: 最终 Commit 和文档更新

**Files:**
- Update documentation

- [ ] **Step 1: 更新项目文档（如果需要）**

更新 MEMORY.md 或相关文档记录 tool calling 功能。

- [ ] **Step 2: 最终提交所有变更**

```bash
git add .
git commit -m "feat: complete knowledge base tool calling implementation

- Add toolCalls field to ChatMessage model
- Implement knowledge_base_search tool in LlmService
- Update ChatService to use tool calling mode
- Support intelligent retrieval decision by LLM
- Handle streaming and error scenarios

Tested scenarios:
- Knowledge base questions: tool calling with retrieval
- Common knowledge questions: direct LLM response
- No results: explicit user notification
- Multi-turn conversations: context preserved
- Streaming responses: fluent output
- Service errors: graceful degradation"
```

- [ ] **Step 3: Push to remote（可选）**

```bash
git push origin main
```

---

## Success Criteria Checklist

- [ ] 知识库相关问题准确检索并返回答案
- [ ] 常识性问题不触发 tool，直接回答
- [ ] 无结果时明确告知用户
- [ ] 流式响应体验流畅
- [ ] 错误场景降级处理不崩溃
- [ ] Tool calling 元数据完整记录到数据库
- [ ] 响应时间 < 3秒（含 tool calling）
- [ ] 多轮对话上下文正确传递
- [ ] 所有测试场景通过验证