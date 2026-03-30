# 智能回答功能设计方案（Vercel AI SDK 原生版）

**日期：** 2026-03-30
**状态：** 设计确认
**核心方案：** Vercel AI SDK 原生能力 + 标准协议

---

## 一、架构概览

### 1.1 核心设计理念

**完全使用 Vercel AI SDK 原生能力，极简实现：**

1. ✅ 使用 `streamText({ maxSteps: 5, tools })` 自动管理工具调用循环
2. ✅ 使用 `result.toUIMessageStreamResponse()` 返回标准 UI 消息流
3. ✅ 使用 SDK 的 reasoning 配置启用模型思考过程
4. ✅ 前端从 `message.reasoning` 获取推理链
5. ✅ 前端从 `message.toolInvocations` 提取检索元数据和 citations
6. ✅ 解析答案中的引用标记 [1][2]

**无需手动处理：**
- ❌ SSE 事件序列化
- ❌ 两阶段协议管理
- ❌ 自定义 thinking 数据构建
- ❌ 自定义 Provider 解析逻辑

### 1.2 技术栈

- **后端：** NestJS + Vercel AI SDK (`streamText`, `toUIMessageStreamResponse`)
- **前端：** React + Vercel AI SDK (`useChat` hook)
- **协议：** 标准 OpenAI API 协议 + UI Message Stream
- **模型：** 通义千问（OpenAI 兼容模式）

---

## 二、后端实现

### 2.1 LlmService 改造

**文件：** `apps/backend/src/modules/llm/llm.service.ts`

**修改 `generateStream` 方法：**

```typescript
/**
 * 流式生成文本（支持工具调用和 reasoning）
 */
async generateStream(
  messages: ChatMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    enableToolCalling?: boolean;
  } = {}
): Promise<Response> {
  const { temperature = 0.7, maxTokens, enableToolCalling = false } = options;

  try {
    this.logger.debug(`Starting stream generation, toolCalling: ${enableToolCalling}`);

    const result = streamText({
      model: this.openai(this.model),
      messages,
      temperature,
      maxRetries: 3,
      maxTokens,
      maxSteps: enableToolCalling ? 5 : 1, // 最多 5 步工具调用循环
      tools: enableToolCalling
        ? this.getKnowledgeBaseSearchTool()
        : undefined,
    });

    // 返回标准 UI Message Stream Response
    return result.toUIMessageStreamResponse();
  } catch (error) {
    this.logger.error(`Stream generation failed: ${error.message}`);
    throw new Error(`Stream generation failed: ${error.message}`);
  }
}
```

**关键改动：**
- 添加 `maxSteps: 5` 允许最多 5 次工具调用循环
- 返回 `result.toUIMessageStreamResponse()` 而不是 `textStream`
- 返回类型改为 `Promise<Response>`（标准 Response 对象）

### 2.2 System Prompt 优化

**文件：** `apps/backend/src/modules/llm/llm.service.ts`

**确保 `buildToolCallingPrompt` 包含引用格式要求：**

```typescript
buildToolCallingPrompt(): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `你是一个专业的知识库问答助手。

工作流程：
1. 当用户提问时，优先使用 knowledge_base_search 工具搜索知识库
2. 如果找到相关信息，基于检索结果准确回答，并添加引用标记
3. 如果知识库中没有相关信息，可直接回答

回答原则：
- 准确：基于事实和数据，不编造信息
- 清晰：简洁有条理，避免冗余
- 来源透明：引用知识库内容时，在句末添加引用标记 [1]、[2]、[3]，按出现顺序编号
- 诚实：知识库无相关信息时，明确告知

引用标记使用示例：
- "报销流程需要提交发票和申请表 [1]。审批通常需要 3-5 个工作日 [2]。"
- 多个来源标注："...需要提交发票 [1][2]。审批流程如下 [3]。"

注意：引用标记放在标点符号之前，每个标记对应一个文档来源。`,
    },
  ];
}
```

### 2.3 ChatService 简化

**文件：** `apps/backend/src/modules/chat/chat.service.ts`

**移除所有手动 SSE 处理逻辑：**
- ❌ 删除 `serializeSSEEvent`
- ❌ 删除 `buildThinkingInfo`
- ❌ 删除 `buildCitations`
- ❌ 删除 `buildFinalPrompt`
- ❌ 删除 `chatIntelligentStream`

**简化为直接调用 LlmService：**

```typescript
/**
 * 流式聊天
 */
async chatStream(
  request: ChatRequest,
  userId: string
): Promise<Response> {
  const { question, knowledgeBaseId, sessionId } = request;
  const startTime = Date.now();

  try {
    // 1. 创建/获取会话
    let session = sessionId
      ? await this.prisma.chatSession.findUnique({ where: { id: sessionId } })
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

    // 3. 构建消息
    const messages: ChatMessage[] = [
      ...this.llmService.buildToolCallingPrompt(),
      ...history.slice(-12),
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

    // 5. 调用 LLM 流式生成（SDK 自动处理工具调用）
    const response = await this.llmService.generateStream(messages, {
      enableToolCalling: true,
    });

    // 6. 异步保存助手消息（流式结束后）
    this.saveAssistantMessage(response.clone(), session.id, startTime).catch(err => {
      this.logger.error('Failed to save assistant message:', err);
    });

    return response;
  } catch (error) {
    this.logger.error(`Chat stream failed: ${error.message}`);
    throw error;
  }
}

/**
 * 异步保存助手消息
 */
private async saveAssistantMessage(
  response: Response,
  sessionId: string,
  startTime: number
): Promise<void> {
  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let fullContent = '';
    let toolInvocations: any[] = [];
    let usage = null;

    // 读取完整流
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      // 解析 UI Message Stream 格式（SSE）
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));

            if (data.content) {
              fullContent += data.content;
            }

            if (data.toolInvocations) {
              toolInvocations = data.toolInvocations;
            }

            if (data.usage) {
              usage = data.usage;
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    // 提取 citations
    const citations = this.extractCitations(toolInvocations);

    // 保存到数据库
    await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: fullContent,
        toolCalls: toolInvocations.length > 0
          ? { toJSON: () => toolInvocations } as any
          : undefined,
        references: citations.length > 0
          ? { toJSON: () => citations } as any
          : undefined,
        latencyMs: Date.now() - startTime,
        tokensUsed: usage?.totalTokens || 0,
      },
    });

    this.logger.debug(`Saved assistant message for session ${sessionId}`);
  } catch (error) {
    this.logger.error('Error saving assistant message:', error);
  }
}

/**
 * 从工具调用记录中提取 citations
 */
private extractCitations(toolInvocations: any[]): any[] {
  return toolInvocations
    .filter(inv => inv.toolName === 'knowledge_base_search' && inv.result?.results)
    .flatMap(inv =>
      inv.result.results.map((r: any, idx: number) => ({
        index: idx + 1,
        chunkId: r.index.toString(),
        documentId: r.source || '',
        content: r.content,
        source: r.source || '未知文档',
        score: r.score,
      }))
    );
}
```

**注意：** 使用 `response.clone()` 因为 Response body 只能读取一次。

### 2.4 Controller 调整

**文件：** `apps/backend/src/modules/chat/chat.controller.ts`

```typescript
/**
 * 流式聊天（UI Message Stream）
 * POST /api/v1/chat/stream
 */
@Post('stream')
@ApiOperation({ summary: '流式聊天（UI Message Stream）' })
async streamMessage(
  @Body() request: ChatRequest,
  @CurrentUser() user: any
): Promise<Response> {
  return this.chatService.chatStream(request, user.id);
}
```

**返回类型：** 直接返回 `Response` 对象（标准 Web Response）

---

## 三、前端实现

### 3.1 使用标准 `useChat` Hook

**文件：** `apps/frontend/src/pages/Chat/index.tsx`

```typescript
/**
 * 聊天页面 - 使用 Vercel AI SDK useChat
 */
import React, { useState } from 'react';
import { useChat } from 'ai/react';
import { ThinkingCard } from '@/components/ThinkingCard';
import { Citation } from '@/components/Citation';
import { CitationPanel, CitationItem } from '@/components/CitationPanel';
import './index.css';

const ChatPage: React.FC = () => {
  const token = localStorage.getItem('token') || '';

  // 引用面板状态
  const [citationPanelOpen, setCitationPanelOpen] = useState(false);
  const [currentCitations, setCurrentCitations] = useState<CitationItem[]>([]);

  // 使用 Vercel AI SDK 的 useChat hook
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
  } = useChat({
    api: `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/chat/stream`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  // 从 toolInvocations 提取 citations
  const extractCitations = (toolInvocations: any[]): CitationItem[] => {
    return toolInvocations
      .filter(inv => inv.toolName === 'knowledge_base_search' && inv.result?.results)
      .flatMap(inv =>
        inv.result.results.map((r: any, idx: number) => ({
          index: idx + 1,
          chunkId: r.index.toString(),
          documentId: r.source || '',
          content: r.content,
          source: r.source || '未知文档',
          score: r.score,
        }))
      );
  };

  // 渲染带引用标记的内容
  const renderContentWithCitations = (
    content: string,
    citations: CitationItem[]
  ) => {
    if (!citations || citations.length === 0) {
      return <span>{content}</span>;
    }

    const parts = content.split(/(\[\d+\])/g);

    return (
      <div className="message-content">
        <div className="message-text">
          {parts.map((part, idx) => {
            const match = part.match(/\[(\d+)\]/);
            if (match) {
              const citationIndex = parseInt(match[1]);
              const citation = citations.find(c => c.index === citationIndex);
              if (citation) {
                return (
                  <Citation
                    key={idx}
                    index={citation.index}
                    source={citation.source}
                    score={citation.score}
                    onClick={() => {
                      setCurrentCitations(citations);
                      setCitationPanelOpen(true);
                    }}
                  />
                );
              }
            }
            return <span key={idx}>{part}</span>;
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="chat-page">
      <div className="chat-container">
        {/* 消息列表 */}
        <div className="chat-messages">
          {messages.map((msg) => {
            const isAssistant = msg.role === 'assistant';

            // 提取 citations
            const citations = isAssistant && (msg as any).toolInvocations
              ? extractCitations((msg as any).toolInvocations)
              : [];

            // 提取检索元数据
            const toolInvocations = (msg as any).toolInvocations || [];
            const searchTool = toolInvocations.find(
              (inv: any) => inv.toolName === 'knowledge_base_search'
            );

            return (
              <div key={msg.id} className={`message ${msg.role}`}>
                {/* Reasoning 展示（如果有） */}
                {isAssistant && (msg as any).reasoning && (
                  <div className="message-reasoning">
                    <details>
                      <summary>思考过程</summary>
                      <div className="reasoning-content">
                        {(msg as any).reasoning}
                      </div>
                    </details>
                  </div>
                )}

                {/* Thinking Card（检索元数据） */}
                {isAssistant && searchTool && (
                  <ThinkingCard
                    usedToolCalling={true}
                    searchQuery={searchTool.args?.query}
                    resultCount={searchTool.result?.results?.length || 0}
                    topScore={searchTool.result?.results?.[0]?.score}
                    isLoading={false}
                  />
                )}

                {/* 消息内容 */}
                <div className="message-content">
                  {isAssistant
                    ? renderContentWithCitations(msg.content, citations)
                    : msg.content}
                </div>
              </div>
            );
          })}
        </div>

        {/* 输入表单 */}
        <form onSubmit={handleSubmit} className="chat-input">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="输入你的问题..."
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? '发送中...' : '发送'}
          </button>
        </form>
      </div>

      {/* 引用来源面板 */}
      <CitationPanel
        open={citationPanelOpen}
        onClose={() => setCitationPanelOpen(false)}
        citations={currentCitations}
      />
    </div>
  );
};

export default ChatPage;
```

### 3.2 类型定义扩展

**文件：** `apps/frontend/src/types/chat.ts`（如需创建）

```typescript
// 扩展 Vercel AI SDK 的 Message 类型
export interface ExtendedMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string; // 模型推理过程
  toolInvocations?: ToolInvocation[];
}

export interface ToolInvocation {
  toolName: string;
  toolCallId: string;
  args: Record<string, any>;
  result?: Record<string, any>;
  state: 'partial-call' | 'call' | 'result';
}

export interface CitationItem {
  index: number;
  chunkId: string;
  documentId: string;
  content: string;
  source: string;
  score: number;
}
```

---

## 四、数据流示意

```
用户提问："报销流程是什么？"
    ↓
useChat 发送 POST /api/v1/chat/stream
    ↓
LLM 决定调用工具（SDK 自动）
    ↓
SDK 执行 knowledge_base_search 工具
    ↓
工具返回检索结果（5 条文档）
    ↓
SDK 自动继续生成答案（带 [1][2] 引用标记）
    ↓
UI Message Stream 返回：
{
  id: "msg-xxx",
  role: "assistant",
  content: "公司的报销流程需要提交发票和申请表 [1]...",
  reasoning: "用户询问报销流程，我需要先搜索知识库...",
  toolInvocations: [{
    toolName: "knowledge_base_search",
    args: { query: "报销流程" },
    result: {
      results: [
        { index: 1, content: "...", source: "员工手册.pdf", score: 0.85 },
        ...
      ]
    }
  }],
  usage: { promptTokens: 100, completionTokens: 50 }
}
    ↓
前端渲染：
1. Reasoning 折叠面板（可选展开）
2. ThinkingCard（检索关键词、结果数量）
3. 答案文本 + 可点击的引用标记 [1][2]
4. 点击 [1] 打开 CitationPanel
```

---

## 五、UI Message Stream 格式

**标准 SSE 格式：**

```
data: {"id":"msg-xxx","role":"assistant","content":""}

data: {"content":"公司的"}

data: {"content":"报销流程"}

data: {"toolInvocations":[{"toolName":"knowledge_base_search","args":{"query":"报销流程"}}]}

data: {"toolInvocations":[{"toolName":"knowledge_base_search","result":{"results":[...]}}]}

data: {"content":"需要提交发票 [1]。"}

data: {"reasoning":"用户询问报销流程，我先搜索知识库..."}

data: {"usage":{"promptTokens":100,"completionTokens":50}}

data: [DONE]
```

**SDK 自动处理：**
- 工具调用顺序
- 流式传输
- 消息拼接
- 错误重试

---

## 六、关键配置

### 6.1 maxSteps 设置

```typescript
maxSteps: enableToolCalling ? 5 : 1
```

**含义：**
- `1` = 只生成文本，不调用工具
- `2` = 生成 → 调用工具 → 返回结果
- `5` = 最多 5 步循环（检索 → 生成 → 可能再检索 → ...）

**推荐值：** 3-5 次（避免无限循环）

### 6.2 工具定义

```typescript
tools: {
  knowledge_base_search: {
    description: '搜索知识库获取相关文档',
    inputSchema: z.object({
      query: z.string().describe('搜索关键词'),
      topK: z.number().default(5),
      similarityThreshold: z.number().default(0.3),
    }),
    execute: async ({ query, topK, similarityThreshold }) => {
      // 调用 RetrievalService
      const results = await retrievalService.retrieve(query, { topK, similarityThreshold });
      return {
        status: 'success',
        results: results.map((r, idx) => ({
          index: idx + 1,
          content: r.content,
          source: r.metadata?.document?.filename || '未知文档',
          score: r.score,
        })),
      };
    },
  },
}
```

---

## 七、优势总结

### 7.1 相比手动 SSE 方案

| 对比项 | 手动 SSE | Vercel SDK 原生 |
|--------|----------|----------------|
| 代码量 | ~500 行 | ~150 行 |
| SSE 事件处理 | 手动序列化 | SDK 自动 |
| 工具调用循环 | 手动管理 | SDK 自动（maxSteps） |
| 错误重试 | 手动实现 | SDK 内置（maxRetries） |
| 前端 Provider | 自定义解析 | 标准 useChat |
| Reasoning 支持 | 不支持 | 自动支持 |
| 维护成本 | 高 | 低 |

### 7.2 核心优势

✅ **极简实现** - 代码量减少 70%
✅ **SDK 自动管理** - 工具调用循环、错误重试、消息格式
✅ **标准 UI 消息流** - 兼容 Vercel AI SDK 生态
✅ **易于维护** - 遵循最佳实践
✅ **Reasoning 支持** - 展示模型思考过程
✅ **类型安全** - TypeScript 完整支持

---

## 八、测试验证

### 8.1 后端测试

**测试成功检索：**

```bash
curl -X POST http://localhost:3000/api/v1/chat/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"报销流程是什么？"}'
```

**预期：**
- 返回标准 UI Message Stream
- 包含 `toolInvocations` 数组
- 包含 `content` 文本流
- 包含 `reasoning`（如果模型支持）

### 8.2 前端测试

**测试场景：**
1. ✅ 输入问题，点击发送
2. ✅ 看到模型 reasoning（折叠面板）
3. ✅ 看到 ThinkingCard（检索元数据）
4. ✅ 看到流式答案文本
5. ✅ 看到引用标记 [1][2]
6. ✅ 点击引用标记打开 CitationPanel
7. ✅ 查看完整引用详情

---

## 九、注意事项

### 9.1 Response Body 只能读取一次

```typescript
// ❌ 错误：直接返回 response，无法保存消息
return response;

// ✅ 正确：clone 后分别使用
this.saveAssistantMessage(response.clone(), ...);
return response;
```

### 9.2 Tool Invocation State

```typescript
state: 'partial-call' | 'call' | 'result'
```

- `partial-call` = 工具参数流式生成中
- `call` = 工具参数完整，准备执行
- `result` = 工具执行完成，有结果

**前端应过滤 `state === 'result'` 的调用。**

### 9.3 Reasoning 兼容性

并非所有模型都支持 reasoning。前端应检查：

```typescript
{(msg as any).reasoning && <ReasoningCard reasoning={msg.reasoning} />}
```

---

## 十、相关文件清单

### 后端文件

- `apps/backend/src/modules/llm/llm.service.ts` - 修改 `generateStream` 方法
- `apps/backend/src/modules/chat/chat.service.ts` - 简化逻辑，删除手动 SSE
- `apps/backend/src/modules/chat/chat.controller.ts` - 返回 Response 对象

### 前端文件

- `apps/frontend/src/pages/Chat/index.tsx` - 使用 `useChat` hook
- `apps/frontend/src/types/chat.ts` - 扩展类型定义（可选）
- `apps/frontend/src/components/*` - 复用现有组件

---

**文档状态：** 设计完成，待用户确认