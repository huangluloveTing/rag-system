# Knowledge Base Tool Calling 设计方案

**日期**: 2026-03-28
**状态**: 待审批
**目标**: 使用 Tool Calling 实现智能知识库检索功能

---

## Overview

### 问题背景

当前 ChatService 的非流式方法已经注释掉了手动检索逻辑。需要重新设计聊天功能，实现：
- 根据聊天内容自动判断是否需要检索知识库
- 如果知识库有相关答案，返回检索结果增强的回答
- 如果没有相关答案，使用大模型的内置知识回答

### 设计方案

采用 **智能 Tool Calling 模式**：
- 给 LLM 提供一个 `knowledge_base_search` tool
- LLM 自己判断问题是否需要检索知识库
- 使用 Vercel AI SDK 的 tools 功能自动处理调用循环
- 支持流式响应 + tool calling

### 技术栈选择

- **Vercel AI SDK**: `generateText` 和 `streamText` 的 `tools` 参数
- **Zod**: 用于 tool parameters schema 定义
- 自动处理：tool call → execute → continue generation

---

## Architecture

### 整体架构

```
用户问题
    ↓
ChatService.chat()
    ↓
构建 messages (system prompt + history + question)
    ↓
LlmService.generate() / generateStream()
    ↓
Vercel AI SDK (generateText/streamText with tools)
    ↓
LLM 判断是否调用 tool
    ↓
[如果调用] Tool Execution
    ↓           ↓
    ↓     RetrievalService.retrieve()
    ↓           ↓
    ↓     向量检索 + Rerank
    ↓           ↓
    ↓     返回检索结果给 LLM
    ↓
LLM 生成最终答案 (基于 tool 结果或内置知识)
    ↓
ChatService 保存消息 + tool calling 元数据
    ↓
返回答案给用户
```

### 核心改动点

**LlmService 改动：**
- 新增 `knowledgeBaseSearchTool` 定义
- `generate()` 和 `generateStream()` 新增 `tools` 参数
- 新增 `buildToolCallingPrompt()` 方法
- 新增 `onToolCall` callback 记录调用日志

**ChatService 改动：**
- 移除手动检索逻辑（line 105-112）
- 使用 `LlmService` 的 tool calling 模式
- 调整消息构建逻辑（使用 tool calling system prompt）
- 保存 tool calling 元数据到数据库

**RetrievalService：**
- 保持不变，被 tool 的 `execute` 函数调用
- 参数通过 tool args 传递（query, topK, similarityThreshold）

**Prisma Schema 改动：**
- `ChatMessage` 模型新增 `toolCalls` 字段（JSON 类型）

---

## Tool Definition

### Tool Schema

使用 Vercel AI SDK + Zod 定义：

```typescript
const knowledgeBaseSearchTool = {
  knowledge_base_search: {
    description: `搜索知识库以获取与用户问题相关的文档内容。

适用场景：
- 用户询问特定领域的专业知识、技术细节
- 涉及公司政策、流程规范、产品特性等
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

    execute: async ({ query, topK, similarityThreshold }) => {
      // Tool execution logic
    },
  },
};
```

### Parameters 默认值（系统配置）

从环境变量读取，作为 tool 的默认值：
- `TOP_K=5` - 返回 5 条结果
- `SIMILARITY_THRESHOLD=0.3` - 相似度阈值 0.3
- 参数范围：topK (1-10)，similarityThreshold (0-1)

### Tool Execution Logic

```typescript
execute: async ({ query, topK, similarityThreshold }) => {
  try {
    const results = await retrievalService.retrieve(query, {
      topK,
      similarityThreshold,
      enableRerank: true,
      knowledgeBaseId: undefined, // 搜索所有知识库
    });

    if (results.length === 0) {
      return {
        status: 'no_results',
        message: '知识库中没有找到相关信息。',
        results: [],
      };
    }

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
    return {
      status: 'error',
      message: `知识库检索失败：${error.message}`,
      results: [],
    };
  }
}
```

### Tool Result Format

返回给 LLM 的 JSON 结构：

```typescript
{
  status: 'success' | 'no_results' | 'error',
  message: string,
  results: Array<{
    index: number,
    content: string,
    source: string,
    score: number,
  }>
}
```

LLM 可以根据 `status` 判断检索情况，根据 `results` 生成答案。

---

## System Prompt & Messages

### System Prompt

```typescript
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

### Messages 构建流程

```typescript
const messages: ChatMessage[] = [
  ...this.llmService.buildToolCallingPrompt(),  // System prompt + tool 引导
  ...history.slice(-6),  // 最近 6 条历史消息
  { role: 'user', content: question }  // 当前问题
];
```

### Tool Calling 循环控制

使用 `maxSteps` 参数控制循环次数：

```typescript
const result = await generateText({
  model: this.openai(this.model),
  messages,
  tools: knowledgeBaseSearchTool,
  maxSteps: 3,  //最多 3 步：tool call → execute → final response
});
```

---

## Streaming & Metadata

### Streaming Tool Calling

Vercel AI SDK 的 `streamText` 自动处理 tool calling：

```typescript
const result = streamText({
  model: this.openai(this.model),
  messages,
  tools: knowledgeBaseSearchTool,
  maxSteps: 3,
});

return result.textStream;  // SDK 自动合并后的文本流
```

**用户体验：**
- Tool calling 在后台执行
- 用户看到流畅的答案输出
- 不感知中间的 tool calling 过程

### Tool Calling Metadata Recording

使用 `onToolCall` callback 记录：

```typescript
interface ToolCallLog {
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

const toolCalls: ToolCallLog[] = [];

const result = await generateText({
  model: this.openai(this.model),
  messages,
  tools: knowledgeBaseSearchTool,
  maxSteps: 3,
  onToolCall: ({ toolCall, toolResult }) => {
    toolCalls.push({
      toolName: toolCall.toolName,
      toolArgs: toolCall.args,
      toolResult,
      timestamp: new Date(),
    });
  },
});
```

### Message Saving Strategy

修改 `ChatService.chat()` 的保存逻辑：

```typescript
await this.prisma.chatMessage.create({
  data: {
    sessionId: session.id,
    role: 'assistant',
    content: llmResponse.content,
    toolCalls: toolCalls.length > 0 ? toolCalls : null,
    references: toolCalls.length > 0
      ? toolCalls.flatMap(tc => tc.toolResult.results || [])
      : null,
    latencyMs: Date.now() - startTime,
    tokensUsed: llmResponse.usage.total_tokens,
  },
});
```

---

## Error Handling

### Tool Execution Errors

Tool 内部捕获异常，返回错误状态给 LLM：

```typescript
execute: async ({ query, topK, similarityThreshold }) => {
  try {
    // ... retrieval logic
  } catch (error) {
    return {
      status: 'error',
      message: `知识库检索失败：${error.message}`,
      results: [],
    };
  }
}
```

**LLM 降级处理：**
- LLM 收到 `error` 状态
- 可以告知用户系统异常
- 或基于内置知识回答（如果问题允许）

### Timeout Handling

设置总超时时间：

```typescript
const result = await generateText({
  model: this.openai(this.model),
  messages,
  tools: knowledgeBaseSearchTool,
  maxSteps: 3,
  abortSignal: AbortSignal.timeout(30000),  // 30秒总超时
});
```

### Service Degradation

当检索服务不可用时：
- Tool execution 返回错误
- 基本聊天功能保持可用（降级为普通 LLM 对话）
- 用户仍可获得答案（可能是基于内置知识）

### Empty Knowledge Base

当知识库无文档时：
- Tool 总是返回 `no_results`
- LLM 明确告知用户"知识库中没有相关信息"
- 用户知道需要上传文档

---

## Database Schema Changes

### ChatMessage Model Update

新增 `toolCalls` 字段：

```prisma
model ChatMessage {
  id          String   @id @default(cuid())
  sessionId   String
  role        String   // 'user' or 'assistant'
  content     String
  references  Json?    // 引用来源（JSON array）
  toolCalls   Json?    // Tool calling记录（新增）
  latencyMs   Int?
  tokensUsed  Int?
  createdAt   DateTime @default(now())

  session     ChatSession @relation(fields: [sessionId], references: [id])

  @@index([sessionId])
}
```

**`toolCalls` 字段结构：**

```json
[
  {
    "toolName": "knowledge_base_search",
    "toolArgs": {
      "query": "报销流程",
      "topK": 5,
      "similarityThreshold": 0.3
    },
    "toolResult": {
      "status": "success",
      "message": "找到 3 条相关信息",
      "results": [
        {
          "index": 1,
          "content": "...",
          "source": "员工手册.pdf",
          "score": 0.85
        }
      ]
    },
    "timestamp": "2026-03-28T10:30:00Z"
  }
]
```

---

## Testing Strategy

### Test Scenarios

**场景 1：知识库相关问题**
- 输入："公司的报销流程是什么？"
- 预期：LLM 调用 `knowledge_base_search` tool
- 验证：tool 被调用，返回检索结果，答案包含来源引用

**场景 2：常识性问题**
- 输入："你好" 或 "什么是人工智能？"
- 预期：LLM 不调用 tool，直接回答
- 验证：tool 未被调用，答案来自 LLM 内置知识

**场景 3：知识库无结果**
- 输入："如何修理火星车？"（知识库中无相关文档）
- 预期：LLM 调用 tool，返回 `no_results`
- 验证：tool 被调用，LLM 明确告知用户知识库无相关信息

**场景 4：多轮对话**
- 输入："报销需要提交什么材料？" → tool 调用
- 输入："提交后多久能审批？" → tool 再次调用
- 验证：历史消息正确传递，多轮 tool calling 正常工作

**场景 5：流式响应**
- 输入：请求流式聊天
- 预期：tool calling 在后台执行，用户看到流畅输出
- 验证：响应是流式的，无感知 tool calling延迟

**场景 6：检索服务异常**
- Mock RetrievalService 返回错误
- 预期：tool execution 返回错误，LLM 降级处理
- 验证：聊天功能不崩溃，LLM 告知用户或基于内置知识回答

### Verification Metrics

- **Tool 调用率**：统计多少比例的问题触发了检索
- **检索命中率**：知识库相关问题是否成功找到结果
- **答案质量**：人工评估准确性、完整性、来源引用
- **响应时间**：tool calling 是否显著增加延迟（目标 < 3秒）

---

## Implementation Plan Outline

1. **Prisma Schema 更新** - 添加 `toolCalls` 字段并迁移
2. **LlmService 改造** - 定义 tool schema 和 execution logic
3. **ChatService 改造** - 移除手动检索，使用 tool calling 模式
4. **System Prompt 调整** - 添加 tool 引导
5. **错误处理完善** - tool execution 和 timeout 处理
6. **测试验证** - 单元测试 +集成测试 + 手动测试
7. **监控和日志** - tool calling 记录和性能分析

---

## Success Criteria

- ✅ 知识库相关问题准确检索并返回答案
- ✅ 常识性问题不触发 tool，直接回答
- ✅ 无结果时明确告知用户
- ✅ 流式响应体验流畅
- ✅ 错误场景降级处理不崩溃
- ✅ Tool calling 元数据完整记录
- ✅ 响应时间 < 3秒（含 tool calling）