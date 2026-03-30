# 智能回答功能设计文档

**日期：** 2026-03-30
**状态：** 设计确认，待实施
**核心方案：** 两阶段流式协议 + 专用 RAG 端点 + Vercel AI SDK

---

## 一、架构概览

### 1.1 核心技术方案

采用**两阶段流式协议**，将检索阶段（非流式 Tool Calling）和生成阶段（流式文本生成）分离，通过 SSE 自定义事件类型传递结构化元数据。

### 1.2 工作流程

```
用户提问 → 后端接收请求
         → Phase 1: 检索阶段（非流式 Tool Calling）
            ├─ 执行检索（generateText + tools）
            ├─ 发送 thinking 事件（检索关键词、结果数量）
            ├─ 发送 citations 事件（引用列表）
         → Phase 2: 生成阶段（流式生成）
            ├─ streamText 流式输出答案
            ├─ 实时发送 content 事件
         → 发送 done 事件（usage、sessionId）
         → 前端实时展示
            ├─ ThinkingCard（检索信息）
            ├─ 流式答案文本 + 引用标记 [1][2]
            ├─ CitationPanel（侧边抽屉）
```

---

## 二、关键设计决策

### 2.1 SSE 事件格式

**决策：自定义事件类型**

使用 SSE 的 `event` 字段区分消息类型，保持协议简洁清晰：

```
event: phase
data: {"phase":"retrieval","status":"started"}

event: thinking
data: {"usedToolCalling":true,"searchQuery":"关键词","resultCount":5}

event: citations
data: {"citations":[...]}

event: content
data: {"text":"答案片段"}

event: done
data: {"sessionId":"xxx","usage":{...}}
```

**理由：**
- 阶段分离，易于前端解析和状态管理
- 不依赖 Vercel SDK 的实验性 API
- 协议可扩展，未来可加入更多事件类型

### 2.2 Tool Calling 决策策略

**决策：依赖 LLM 智能决策**

如果 LLM 决定不调用工具（如问候、常识问题），跳过检索阶段，直接生成答案，thinking 显示"基于通用知识回答"。

**理由：**
- 保持用户体验自然流畅
- 避免不必要的检索开销
- 信任 LLM 的意图判断能力

### 2.3 检索失败处理

**决策：仍展示检索信息**

即使检索返回 `no_results`，仍发送 thinking 事件显示"检索关键词：XXX，找到 0 条结果"，然后 LLM 基于通用知识回答。

**理由：**
- 信息透明，用户能看到检索尝试过程
- 避免突然跳过阶段造成体验断层
- 明确告知未找到结果的原因

### 2.4 引用展示方式

**决策：侧边抽屉面板**

点击引用标记 [1][2] 后，打开右侧 Drawer（CitationPanel），显示引用列表详情（文件名、相似度、完整内容片段）。

**理由：**
- 不打断答案文本阅读流
- 可查看多个引用的完整详情
- 符合现有组件设计（CitationPanel 已实现）

---

## 三、后端实现

### 3.1 SSE 事件协议定义

**事件类型：**

| 事件名 | 数据结构 | 说明 |
|--------|----------|------|
| `phase` | `{phase: 'retrieval'|'generation', status: 'started'|'completed'}` | 阶段切换通知 |
| `thinking` | `ThinkingEvent` | 检索信息（关键词、结果数、是否使用工具） |
| `citations` | `{citations: CitationItem[]}` | 引用列表 |
| `content` | `{text: string}` | 答案文本片段 |
| `done` | `DoneEvent` | 完成信号（sessionId、usage、chatMessageId） |
| `error` | `{message: string}` | 错误信息 |

**详细数据结构：**

```typescript
// Thinking 事件
interface ThinkingEvent {
  usedToolCalling: boolean;
  searchQuery?: string;
  resultCount?: number;
  topScore?: number;
  message?: string; // "未找到相关信息" 或 "基于通用知识回答"
}

// CitationItem 结构
interface CitationItem {
  index: number;
  chunkId: string;
  documentId: string;
  content: string;
  source: string; // 文件名
  score: number;
}

// Done 事件
interface DoneEvent {
  sessionId: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  chatMessageId: string; // 用于反馈功能
}
```

### 3.2 事件序列示例

**场景 1：成功检索并回答**
```
event: phase
data: {"phase":"retrieval","status":"started"}

event: thinking
data: {"usedToolCalling":true,"searchQuery":"报销流程","resultCount":5,"topScore":0.85}

event: citations
data: {"citations":[{"index":1,"source":"员工手册.pdf","content":"...",...}]}

event: phase
data: {"phase":"generation","status":"started"}

event: content
data: {"text":"公司的"}

event: content
data: {"text":"报销流程需要..."}

event: done
data: {"sessionId":"xxx","usage":{...},"chatMessageId":"yyy"}
```

**场景 2：未找到结果**
```
event: phase
data: {"phase":"retrieval","status":"started"}

event: thinking
data: {"usedToolCalling":true,"searchQuery":"XXX","resultCount":0,"message":"知识库中未找到相关信息"}

event: phase
data: {"phase":"generation","status":"started"}

event: content
data: {"text":"抱歉，知识库中没有找到..."}
```

**场景 3：不调用工具（通用知识）**
```
event: phase
data: {"phase":"retrieval","status":"started"}

event: thinking
data: {"usedToolCalling":false,"message":"基于通用知识回答"}

event: phase
data: {"phase":"generation","status":"started"}

event: content
data: {"text":"你好！我是..."}
```

### 3.3 ChatService 改造

**文件位置：** `apps/backend/src/modules/chat/chat.service.ts`

**新增方法：** `chatIntelligentStream`

**核心实现逻辑：**

```typescript
async *chatIntelligentStream(
  request: ChatRequest,
  userId: string
): AsyncGenerator<string> {
  const { question, knowledgeBaseId, sessionId } = request;
  const startTime = Date.now();

  // 1. 创建/获取会话
  let session = sessionId
    ? await this.prisma.chatSession.findUnique({ where: { id: sessionId } })
    : null;

  if (!session) {
    session = await this.prisma.chatSession.create({
      data: { userId, knowledgeBaseId, title: question.substring(0, 50) },
    });
  }

  // 2. 获取历史消息
  const history = await this.getChatHistory(session.id);

  // 3. 构建 Tool Calling Prompt
  const messages: ChatMessage[] = [
    ...this.llmService.buildToolCallingPrompt(),
    ...history.slice(-12),
    { role: 'user', content: question }
  ];

  // 4. 保存用户消息
  await this.prisma.chatMessage.create({
    data: { sessionId: session.id, role: 'user', content: question },
  });

  // Phase 1: 检索阶段
  yield this.serializeSSEEvent('phase', { phase: 'retrieval', status: 'started' });

  // 使用 generateText 执行 Tool Calling（非流式）
  const retrievalResult = await this.llmService.generate(messages, {
    enableToolCalling: true,
  });

  // 构建 thinking 信息
  const thinking = this.buildThinkingInfo(retrievalResult.toolCalls);
  yield this.serializeSSEEvent('thinking', thinking);

  // 发送 citations（如果有）
  if (thinking.usedToolCalling && retrievalResult.toolCalls) {
    const citations = this.buildCitations(retrievalResult.toolCalls);
    yield this.serializeSSEEvent('citations', { citations });
  }

  yield this.serializeSSEEvent('phase', { phase: 'generation', status: 'started' });

  // Phase 2: 生成阶段
  // 构建最终 Prompt（注入检索结果）
  const finalMessages = this.buildFinalPrompt(messages, retrievalResult);

  // 流式生成答案
  const stream = await this.llmService.generateStream(finalMessages, {
    enableToolCalling: false,
  });

  let fullContent = '';
  for await (const chunk of stream) {
    fullContent += chunk;
    yield this.serializeSSEEvent('content', { text: chunk });
  }

  // 5. 保存助手消息
  const assistantMessage = await this.prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: 'assistant',
      content: fullContent,
      toolCalls: retrievalResult.toolCalls ? { toJSON: () => retrievalResult.toolCalls } as any : undefined,
      references: thinking.usedToolCalling ? { toJSON: () => this.buildReferences(retrievalResult.toolCalls) } as any : undefined,
      latencyMs: Date.now() - startTime,
      tokensUsed: retrievalResult.usage.total_tokens,
    },
  });

  // 发送 done 事件
  yield this.serializeSSEEvent('done', {
    sessionId: session.id,
    usage: retrievalResult.usage,
    chatMessageId: assistantMessage.id,
  });

  this.logger.debug(`Intelligent stream completed in ${Date.now() - startTime}ms`);
}

// 辅助方法：序列化 SSE 事件
private serializeSSEEvent(event: string, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// 辅助方法：构建 thinking 信息
private buildThinkingInfo(toolCalls?: ToolCallLog[]): ThinkingInfo {
  if (!toolCalls || toolCalls.length === 0) {
    return {
      usedToolCalling: false,
      message: '基于通用知识回答',
    };
  }

  const toolCall = toolCalls[0];
  const resultCount = toolCall.toolResult.results.length;

  return {
    usedToolCalling: true,
    searchQuery: toolCall.toolArgs.query,
    resultCount,
    topScore: resultCount > 0 ? toolCall.toolResult.results[0].score : 0,
    message: resultCount === 0 ? '知识库中未找到相关信息' : undefined,
  };
}

// 辅助方法：构建 citations
private buildCitations(toolCalls: ToolCallLog[]): CitationItem[] {
  return toolCalls.flatMap(tc =>
    tc.toolResult.results.map((result, idx) => ({
      index: result.index,
      chunkId: result.index.toString(),
      documentId: result.source,
      content: result.content,
      source: result.source,
      score: result.score,
    }))
  );
}

// 辅助方法：构建最终 Prompt
private buildFinalPrompt(
  originalMessages: ChatMessage[],
  retrievalResult: LLMResponse
): ChatMessage[] {
  // 如果检索成功，注入检索结果到 system prompt
  if (retrievalResult.toolCalls && retrievalResult.toolCalls.length > 0) {
    const toolCall = retrievalResult.toolCalls[0];
    if (toolCall.toolResult.status === 'success' && toolCall.toolResult.results.length > 0) {
      const contextText = toolCall.toolResult.results
        .map((r, idx) => `[${r.index}] ${r.content}（来源：${r.source}）`)
        .join('\n\n');

      const ragSystemPrompt = `你是一个专业的知识库问答助手。基于以下检索到的信息回答用户问题。

检索到的相关信息：
${contextText}

回答要求：
1. 答案必须基于上述信息，准确引用来源
2. 在句末标注引用标记，如 [1]、[2]
3. 如果信息不足，明确告知用户
4. 回答简洁清晰`;

      return [
        { role: 'system', content: ragSystemPrompt },
        ...originalMessages.slice(1).filter(m => m.role !== 'system'),
      ];
    }
  }

  // 否则使用原始 Tool Calling prompt
  return originalMessages;
}
```

### 3.4 Controller 调整

**文件位置：** `apps/backend/src/modules/chat/chat.controller.ts`

**修改：** `POST /chat/stream` 端点

```typescript
@Post('stream')
@Sse()
@ApiOperation({ summary: '智能流式聊天（两阶段协议）' })
async intelligentStreamMessage(
  @Body() request: ChatRequest,
  @CurrentUser() user: any
): Promise<Observable<MessageEvent>> {
  const generator = this.chatService.chatIntelligentStream(request, user.id);

  return from(generator).pipe(
    map((chunk) => ({
      data: chunk,
    }))
  );
}
```

**注意：** NestJS SSE 要求返回 `Observable<MessageEvent>`，其中 `MessageEvent.data` 是字符串。

---

## 四、前端实现

### 4.1 RAGStreamProvider 实现

**文件位置：** `apps/frontend/src/providers/RAGStreamProvider.ts`（新建）

**核心职责：**
- 解析自定义 SSE 事件流
- 维护消息状态（content、thinking、citations、status）
- 提供转换方法给 useXChat Hook

**数据结构：**

```typescript
interface StreamMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string; // 累积的答案文本
  status: 'loading' | 'success' | 'error';

  // RAG 元数据
  thinking?: ThinkingEvent;
  citations?: CitationItem[];
  sessionId?: string;
  chatMessageId?: string;
  usage?: UsageInfo;

  // UI 状态
  phase?: 'retrieval' | 'generation';
  isRetrieving?: boolean;
}
```

**Provider 实现：**

```typescript
import { AbstractChatProvider } from '@ant-design/x-sdk';
import type { XRequestOptions, TransformMessage } from '@ant-design/x-sdk';

export class RAGStreamProvider extends AbstractChatProvider<
  StreamMessage,
  ChatRequest,
  string // SSE chunk 是字符串
> {
  private apiUrl: string;
  private token: string;

  constructor(config: { apiUrl: string; token: string }) {
    super();
    this.apiUrl = config.apiUrl;
    this.token = config.token;
  }

  transformParams(
    requestParams: Partial<ChatRequest>,
    options: XRequestOptions
  ): ChatRequest {
    return {
      question: requestParams.question || '',
      sessionId: requestParams.sessionId,
      knowledgeBaseId: requestParams.knowledgeBaseId,
      stream: true,
    };
  }

  transformLocalMessage(requestParams: Partial<ChatRequest>): StreamMessage {
    return {
      id: `user-${Date.now()}`,
      role: 'user',
      content: requestParams.question || '',
      status: 'loading',
      isRetrieving: true,
    };
  }

  transformMessage(info: TransformMessage<StreamMessage, string>): StreamMessage {
    const { originMessage, chunk } = info;

    // 解析 SSE 事件
    const event = this.parseSSEEvent(chunk);

    if (!originMessage) {
      // 初始化消息
      const initialMessage: StreamMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        status: 'loading',
        isRetrieving: true,
      };
      this.handleEvent(initialMessage, event);
      return initialMessage;
    }

    // 更新消息状态
    this.handleEvent(originMessage, event);
    return originMessage;
  }

  private parseSSEEvent(chunk: string): { event: string; data: any } {
    const lines = chunk.split('\n');
    let eventType = '';
    let dataStr = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.substring(7);
      } else if (line.startsWith('data: ')) {
        dataStr = line.substring(6);
      }
    }

    return {
      event: eventType,
      data: dataStr ? JSON.parse(dataStr) : {},
    };
  }

  private handleEvent(message: StreamMessage, event: { event: string; data: any }) {
    switch (event.event) {
      case 'phase':
        message.phase = event.data.phase;
        message.isRetrieving = event.data.phase === 'retrieval';
        break;

      case 'thinking':
        message.thinking = event.data;
        break;

      case 'citations':
        message.citations = event.data.citations;
        break;

      case 'content':
        message.content += event.data.text;
        message.isRetrieving = false;
        break;

      case 'done':
        message.status = 'success';
        message.sessionId = event.data.sessionId;
        message.chatMessageId = event.data.chatMessageId;
        message.usage = event.data.usage;
        break;

      case 'error':
        message.status = 'error';
        break;
    }
  }
}

// 工厂函数
export const createRAGStreamProvider = (apiUrl: string, token: string) => {
  return new RAGStreamProvider({ apiUrl, token });
};
```

### 4.2 ChatPage 改造

**文件位置：** `apps/frontend/src/pages/Chat/index.tsx`

**核心改造：**

```typescript
import React, { useMemo, useState, useCallback } from 'react';
import { useXChat } from '@ant-design/x-sdk';
import { Bubble, Sender } from '@ant-design/x';
import { createRAGStreamProvider } from '@/providers/RAGStreamProvider';
import { ThinkingCard } from '@/components/ThinkingCard';
import { Citation } from '@/components/Citation';
import { CitationPanel, CitationItem } from '@/components/CitationPanel';
import { FeedbackButton } from '@/components/FeedbackButton';
import './index.css';

const ChatPage: React.FC = () => {
  const token = localStorage.getItem('token') || '';

  // 引用面板状态
  const [citationPanelOpen, setCitationPanelOpen] = useState(false);
  const [currentCitations, setCurrentCitations] = useState<CitationItem[]>([]);

  // 创建 Provider
  const provider = useMemo(() => {
    const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/chat/stream`;
    return createRAGStreamProvider(apiUrl, token);
  }, [token]);

  // 使用 useXChat
  const { messages, onRequest, isRequesting, abort } = useXChat({
    provider,
  });

  // 发送消息
  const handleSubmit = (content: string) => {
    if (!content.trim() || isRequesting) return;

    onRequest({
      question: content,
    });
  };

  // 显示引用面板
  const handleCitationClick = useCallback((citations: CitationItem[]) => {
    setCurrentCitations(citations);
    setCitationPanelOpen(true);
  }, []);

  // 渲染带引用的内容
  const renderContentWithCitations = useCallback(
    (content: string, citations?: CitationItem[]) => {
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
                      onClick={() => handleCitationClick(citations)}
                    />
                  );
                }
              }
              return <span key={idx}>{part}</span>;
            })}
          </div>
        </div>
      );
    },
    [handleCitationClick]
  );

  return (
    <div className="chat-page">
      <div className="chat-container">
        {/* 消息列表 */}
        <div className="chat-messages">
          <Bubble.List
            items={messages.map((msg) => {
              const isAssistant = msg.message.role === 'assistant';

              return {
                key: msg.id,
                role: msg.message.role,
                placement: isAssistant ? 'start' : 'end',
                typing: msg.message.status === 'loading' && msg.message.isRetrieving,
                avatar: isAssistant ? '🤖' : '👤',

                // Header: ThinkingCard
                header: isAssistant && msg.message.thinking ? (
                  <ThinkingCard
                    usedToolCalling={msg.message.thinking.usedToolCalling}
                    searchQuery={msg.message.thinking.searchQuery}
                    resultCount={msg.message.thinking.resultCount}
                    topScore={msg.message.thinking.topScore}
                    message={msg.message.thinking.message}
                    isLoading={msg.message.isRetrieving}
                  />
                ) : undefined,

                // Content: 带引用的文本
                content: isAssistant
                  ? renderContentWithCitations(msg.message.content, msg.message.citations)
                  : msg.message.content,

                // Footer: FeedbackButton
                footer: isAssistant && msg.message.chatMessageId ? (
                  <FeedbackButton
                    chatMessageId={msg.message.chatMessageId}
                    onFeedbackSubmitted={() => {}}
                  />
                ) : undefined,

                styles: {
                  content: {
                    backgroundColor: isAssistant ? '#f0f0f0' : '#1890ff',
                    color: isAssistant ? '#000' : '#fff',
                    maxWidth: '80%',
                  },
                },
              };
            })}
            style={{ maxHeight: 'calc(100vh - 200px)' }}
          />
        </div>

        {/* 输入区域 */}
        <div className="chat-input">
          <Sender
            loading={isRequesting}
            onSubmit={handleSubmit}
            onCancel={abort}
            placeholder="输入你的问题... (Enter 发送，Shift + Enter 换行)"
          />
        </div>
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

### 4.3 现有组件使用

**复用现有组件：**
- `ThinkingCard` - 展示检索信息（已实现，无需修改）
- `Citation` - 引用标记组件（已实现，无需修改）
- `CitationPanel` - 侧边抽屉面板（已实现，无需修改）
- `FeedbackButton` - 反馈按钮（已实现，无需修改）

**样式文件：**
- `apps/frontend/src/pages/Chat/index.css` - 可能需要调整布局以适配新 UI

---

## 五、错误处理

### 5.1 后端错误场景

| 场景 | 处理方式 |
|------|----------|
| 检索失败 | thinking 显示 `message: "知识库检索失败"`，继续生成答案 |
| LLM 生成失败 | 发送 `event: error`，前端显示错误提示 |
| Token 超限 | 检查 usage，超过阈值时截断历史消息（保留最近 10 条） |
| Tool Calling 失败 | 记录错误日志，thinking 显示未使用工具，使用通用知识回答 |

### 5.2 前端错误处理

| 场景 | 处理方式 |
|------|----------|
| SSE 解析失败 | 显示"解析错误，请重试"，提供重发按钮 |
| 网络中断 | 提示连接断开，提供重连按钮（保存 sessionId） |
| 引用标记缺失 | 如果找不到对应的 citation，忽略标记显示纯文本 |
| Provider 初始化失败 | 显示"初始化失败"，刷新页面 |

---

## 六、测试验证

### 6.1 后端测试

**测试 SSE 流式响应：**

```bash
# 测试成功检索场景
curl -X POST http://localhost:3000/api/v1/chat/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"报销流程是什么？"}'

# Expected events:
# event: phase → event: thinking → event: citations → event: phase → event: content... → event: done
```

**测试未找到结果场景：**

```bash
curl -X POST http://localhost:3000/api/v1/chat/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"如何造火箭？"}'

# Expected: thinking 显示 resultCount: 0
```

**测试不调用工具场景：**

```bash
curl -X POST http://localhost:3000/api/v1/chat/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"你好"}'

# Expected: thinking 显示 usedToolCalling: false
```

### 6.2 前端测试场景

- ✅ 成功检索 + 流式输出 + ThinkingCard 显示 + 引用标记渲染
- ✅ 点击引用标记 + CitationPanel 打开 + 显示详情列表
- ✅ 未找到结果 + thinking 提示 + 基于通用知识回答
- ✅ 不调用工具（问候）+ thinking 提示 + 无检索阶段
- ✅ 反馈功能 + chatMessageId 正确传递
- ✅ 多轮对话 + sessionId 正确管理
- ✅ 网络中断 + 重连功能
- ✅ 错误处理 + 提示信息

---

## 七、实现优先级

### 阶段 1：核心流程（必须）

1. 后端 SSE 事件序列实现（serializeSSEEvent 方法）
2. ChatService.chatIntelligentStream 核心逻辑
3. ChatController 端点调整
4. RAGStreamProvider SSE 解析逻辑
5. ChatPage 基础渲染和事件处理

### 阶段 2：UI 增强（必须）

6. ThinkingCard 实时状态展示（loading 状态）
7. Citation 组件点击交互
8. CitationPanel 数据展示
9. FeedbackButton 集成

### 阶段 3：完善功能（可选）

10. 错误处理和边界情况
11. 多轮对话 sessionId 管理
12. 性能优化（消息缓存、流式渲染优化）
13. 历史消息截断策略
14. 网络中断重连机制

---

## 八、技术风险和限制

### 8.1 已知限制

1. **Tool Calling 流式模式限制：**
   - Vercel AI SDK 的 `streamText` + `tools` 目前不支持获取完整的 tool calling 元数据
   - 因此必须使用 `generateText` 先执行检索（非流式），再使用 `streamText` 生成答案（流式）
   - 这导致检索阶段用户会等待，但能保证元数据完整性

2. **引用标记准确性：**
   - LLM 需要严格遵循 Prompt 中的引用标记规范（[1]、[2]）
   - 如果 LLM 输出错误格式，前端可能无法正确解析
   - 可考虑后端二次处理（正则修正）

3. **SSE 连接稳定性：**
   - SSE 长连接可能因网络波动断开
   - 需前端提供重连机制
   - 后端需要考虑 timeout 设置

### 8.2 缓解措施

- 在 Prompt 中明确强调引用标记格式要求
- 后端添加引用标记校验和修正逻辑
- 前端添加容错处理（找不到 citation 时忽略标记）
- SSE 连接添加 timeout 和重连逻辑

---

## 九、后续优化方向

1. **检索阶段进度提示：**
   - 添加更细粒度的检索进度（embedding、向量检索、rerank）
   - 让用户了解检索过程的各个步骤

2. **多轮检索优化：**
   - 支持在对话过程中动态调整检索策略
   - 根据用户反馈（点赞/点踩）调整相似度阈值

3. **引用来源交互增强：**
   - 点击引用来源后，高亮答案中对应的引用标记
   - 支持直接跳转到原始文档（如果文档可在线查看）

4. **性能优化：**
   - 检索结果缓存（相同问题的检索结果可复用）
   - 流式渲染优化（减少 DOM 操作）
   - 消息分页加载（历史消息过多时）

---

## 十、相关文件清单

### 后端文件

- `apps/backend/src/modules/chat/chat.service.ts` - 核心改造
- `apps/backend/src/modules/chat/chat.controller.ts` - 端点调整
- `apps/backend/src/modules/llm/llm.service.ts` - 可能需要调整 Tool Calling prompt

### 前端文件

- `apps/frontend/src/providers/RAGStreamProvider.ts` - 新建
- `apps/frontend/src/pages/Chat/index.tsx` - 核心改造
- `apps/frontend/src/components/ThinkingCard.tsx` - 复用
- `apps/frontend/src/components/Citation.tsx` - 复用
- `apps/frontend/src/components/CitationPanel.tsx` - 复用
- `apps/frontend/src/components/FeedbackButton.tsx` - 复用
- `apps/frontend/src/pages/Chat/index.css` - 可能调整样式

---

**文档状态：** 设计完成，待用户确认后进入实施阶段