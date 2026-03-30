# Intelligent Answering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement intelligent RAG-powered answering with two-phase streaming protocol, real-time thinking display, and citation tracking.

**Architecture:** Two-phase SSE streaming (retrieval → generation), custom event protocol, Vercel AI SDK for LLM integration, Ant Design X for frontend streaming UI.

**Tech Stack:** NestJS SSE, Vercel AI SDK, Ant Design X, React hooks (useXChat), TypeScript.

---

## File Structure

**Backend (Modified):**
- `apps/backend/src/modules/chat/chat.service.ts` - Add `chatIntelligentStream` method and helper functions
- `apps/backend/src/modules/chat/chat.controller.ts` - Update `/chat/stream` endpoint to return custom SSE events
- `apps/backend/src/modules/llm/llm.service.ts` - Ensure Tool Calling prompt includes citation format instructions

**Frontend (New + Modified):**
- `apps/frontend/src/providers/RAGStreamProvider.ts` - NEW: Parse custom SSE events, manage message state
- `apps/frontend/src/pages/Chat/index.tsx` - Replace RAGChatProvider with RAGStreamProvider, render thinking/citations
- `apps/frontend/src/pages/Chat/index.css` - Adjust styles if needed for new UI components

**Existing Components (Reuse):**
- `apps/frontend/src/components/ThinkingCard.tsx` - Already implemented, no changes needed
- `apps/frontend/src/components/Citation.tsx` - Already implemented, no changes needed
- `apps/frontend/src/components/CitationPanel.tsx` - Already implemented, no changes needed
- `apps/frontend/src/components/FeedbackButton.tsx` - Already implemented, no changes needed

---

## Task 1: Backend - Add SSE Serialization Helper

**Files:**
- Modify: `apps/backend/src/modules/chat/chat.service.ts`

- [ ] **Step 1: Add serializeSSEEvent helper method**

Add this private method to the `ChatService` class (after line 94, before the `chat` method):

```typescript
/**
 * 序列化 SSE 事件
 * 格式: event: <type>\ndata: <json>\n\n
 */
private serializeSSEEvent(event: string, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
```

- [ ] **Step 2: Verify method added**

Run: Read the file to confirm the method is in the correct location
Expected: Method appears between constructor and `chat` method

---

## Task 2: Backend - Add Thinking Info Builder

**Files:**
- Modify: `apps/backend/src/modules/chat/chat.service.ts`

- [ ] **Step 1: Add buildThinkingInfo helper method**

Add this private method after `serializeSSEEvent`:

```typescript
/**
 * 构建 Thinking 事件数据
 */
private buildThinkingInfo(toolCalls?: any[]): any {
  if (!toolCalls || toolCalls.length === 0) {
    return {
      usedToolCalling: false,
      message: '基于通用知识回答',
    };
  }

  const toolCall = toolCalls[0];
  const resultCount = toolCall.toolResult?.results?.length || 0;

  return {
    usedToolCalling: true,
    searchQuery: toolCall.toolArgs?.query,
    resultCount,
    topScore: resultCount > 0 ? toolCall.toolResult.results[0].score : 0,
    message: resultCount === 0 ? '知识库中未找到相关信息' : undefined,
  };
}
```

- [ ] **Step 2: Verify method signature**

The method takes optional `toolCalls` array from LLM response and returns thinking event structure

---

## Task 3: Backend - Add Citations Builder

**Files:**
- Modify: `apps/backend/src/modules/chat/chat.service.ts`

- [ ] **Step 1: Add buildCitations helper method**

Add this private method after `buildThinkingInfo`:

```typescript
/**
 * 构建 Citations 事件数据
 */
private buildCitations(toolCalls: any[]): any[] {
  return toolCalls.flatMap(tc =>
    tc.toolResult?.results?.map((result: any) => ({
      index: result.index,
      chunkId: result.index.toString(),
      documentId: result.source || '',
      content: result.content,
      source: result.source || '未知文档',
      score: result.score,
    })) || []
  );
}
```

- [ ] **Step 2: Verify citations structure**

Citations array should match frontend `CitationItem` interface

---

## Task 4: Backend - Add Final Prompt Builder

**Files:**
- Modify: `apps/backend/src/modules/chat/chat.service.ts`

- [ ] **Step 1: Add buildFinalPrompt helper method**

Add this private method after `buildCitations`:

```typescript
/**
 * 构建最终生成 Prompt
 * 如果检索成功，注入检索结果到 system prompt
 */
private buildFinalPrompt(
  originalMessages: ChatMessage[],
  retrievalResult: any
): ChatMessage[] {
  // 如果检索成功且有结果
  if (retrievalResult.toolCalls && retrievalResult.toolCalls.length > 0) {
    const toolCall = retrievalResult.toolCalls[0];
    if (toolCall.toolResult?.status === 'success' && toolCall.toolResult.results?.length > 0) {
      const contextText = toolCall.toolResult.results
        .map((r: any) => `[${r.index}] ${r.content}（来源：${r.source}）`)
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

  // 否则返回原始 messages
  return originalMessages;
}
```

- [ ] **Step 2: Verify RAG prompt format**

System prompt includes citation format instructions and retrieved context

---

## Task 5: Backend - Implement Intelligent Stream Core Logic

**Files:**
- Modify: `apps/backend/src/modules/chat/chat.service.ts`

- [ ] **Step 1: Add chatIntelligentStream method signature**

Add new async generator method after existing `chatStream` method (around line 318):

```typescript
/**
 * 智能流式聊天（两阶段协议）
 * Phase 1: 检索（非流式 Tool Calling）
 * Phase 2: 生成（流式文本）
 */
async *chatIntelligentStream(
  request: ChatRequest,
  userId: string
): AsyncGenerator<string> {
```

- [ ] **Step 2: Add session creation logic**

Continue the method implementation:

```typescript
  const { question, knowledgeBaseId, sessionId } = request;
  const startTime = Date.now();

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
```

- [ ] **Step 3: Add history retrieval**

```typescript
  // 2. 获取历史消息
  const history = await this.getChatHistory(session.id);

  // 3. 构建 Tool Calling Prompt
  const messages: ChatMessage[] = [
    ...this.llmService.buildToolCallingPrompt(),
    ...history.slice(-12),
    { role: 'user', content: question }
  ];
```

- [ ] **Step 4: Add user message save**

```typescript
  // 4. 保存用户消息
  await this.prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: 'user',
      content: question,
    },
  });
```

- [ ] **Step 5: Implement Phase 1 - Retrieval**

```typescript
  // Phase 1: 检索阶段
  yield this.serializeSSEEvent('phase', { phase: 'retrieval', status: 'started' });

  // 使用 generateText 执行 Tool Calling（非流式）
  const retrievalResult = await this.llmService.generate(messages, {
    enableToolCalling: true,
  });

  // 发送 thinking 事件
  const thinking = this.buildThinkingInfo(retrievalResult.toolCalls);
  yield this.serializeSSEEvent('thinking', thinking);

  // 发送 citations（如果有）
  if (thinking.usedToolCalling && retrievalResult.toolCalls) {
    const citations = this.buildCitations(retrievalResult.toolCalls);
    yield this.serializeSSEEvent('citations', { citations });
  }

  yield this.serializeSSEEvent('phase', { phase: 'generation', status: 'started' });
```

- [ ] **Step 6: Implement Phase 2 - Generation**

```typescript
  // Phase 2: 生成阶段
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
```

- [ ] **Step 7: Add message save and done event**

```typescript
  // 5. 保存助手消息
  const assistantMessage = await this.prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: 'assistant',
      content: fullContent,
      toolCalls: retrievalResult.toolCalls ? { toJSON: () => retrievalResult.toolCalls } as any : undefined,
      references: thinking.usedToolCalling ? { toJSON: () => this.buildCitations(retrievalResult.toolCalls) } as any : undefined,
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
```

- [ ] **Step 8: Verify complete method structure**

Read the file to confirm the method is properly implemented with all phases

---

## Task 6: Backend - Update Controller Endpoint

**Files:**
- Modify: `apps/backend/src/modules/chat/chat.controller.ts`

- [ ] **Step 1: Locate existing stream endpoint**

Find the `@Post('stream')` endpoint (around line 66-80)

- [ ] **Step 2: Replace stream endpoint implementation**

Replace the existing `streamMessage` method with:

```typescript
  /**
   * 智能流式聊天（两阶段协议）
   * POST /api/v1/chat/stream
   */
  @Post('stream')
  @Sse()
  @ApiOperation({ summary: '智能流式聊天（两阶段 SSE 协议）' })
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

- [ ] **Step 3: Verify SSE return type**

The endpoint returns `Observable<MessageEvent>` where `data` is the serialized SSE string

---

## Task 7: Backend - Verify LLM Service Citation Prompt

**Files:**
- Read: `apps/backend/src/modules/llm/llm.service.ts`

- [ ] **Step 1: Check buildToolCallingPrompt method**

Read lines 184-211 to verify the system prompt includes citation format instructions

Expected: Prompt should mention "在句末标注引用标记，如 [1]、[2]"

- [ ] **Step 2: Verify citation instructions are present**

If citation format is not mentioned, update the system prompt in `buildToolCallingPrompt` method to include:

```typescript
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
```

- [ ] **Step 3: Commit backend changes**

```bash
git add apps/backend/src/modules/chat/chat.service.ts apps/backend/src/modules/chat/chat.controller.ts apps/backend/src/modules/llm/llm.service.ts
git commit -m "feat(chat): implement intelligent streaming with two-phase SSE protocol

- Add chatIntelligentStream method with retrieval and generation phases
- Add SSE event serialization helpers (thinking, citations, content, done)
- Update /chat/stream endpoint to return custom SSE events
- Ensure LLM prompt includes citation format instructions"
```

---

## Task 8: Backend - Test SSE Stream

**Files:**
- None (manual testing)

- [ ] **Step 1: Start backend server**

Run: `pnpm dev:backend`
Wait for server to start on port 3000

- [ ] **Step 2: Test successful retrieval scenario**

Run curl command to test SSE stream:

```bash
curl -X POST http://localhost:3000/api/v1/chat/stream \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"question":"报销流程是什么？"}' \
  --no-buffer
```

Expected: SSE events in order:
- `event: phase` (retrieval started)
- `event: thinking` (searchQuery, resultCount)
- `event: citations` (citations array)
- `event: phase` (generation started)
- `event: content` (multiple chunks)
- `event: done` (sessionId, usage, chatMessageId)

- [ ] **Step 3: Test no results scenario**

```bash
curl -X POST http://localhost:3000/api/v1/chat/stream \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"question":"如何造火箭？"}' \
  --no-buffer
```

Expected: thinking shows `resultCount: 0`, message: "知识库中未找到相关信息"

- [ ] **Step 4: Test no tool calling scenario**

```bash
curl -X POST http://localhost:3000/api/v1/chat/stream \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"question":"你好"}' \
  --no-buffer
```

Expected: thinking shows `usedToolCalling: false`, message: "基于通用知识回答"

---

## Task 9: Frontend - Create RAGStreamProvider

**Files:**
- Create: `apps/frontend/src/providers/RAGStreamProvider.ts`

- [ ] **Step 1: Create provider file structure**

Write the file with imports and interfaces:

```typescript
/**
 * RAG Stream Provider
 * 解析两阶段 SSE 流式协议
 */
import { AbstractChatProvider } from '@ant-design/x-sdk';
import type { XRequestOptions, TransformMessage } from '@ant-design/x-sdk';

// Thinking 事件数据
interface ThinkingEvent {
  usedToolCalling: boolean;
  searchQuery?: string;
  resultCount?: number;
  topScore?: number;
  message?: string;
}

// Citation 数据
interface CitationItem {
  index: number;
  chunkId: string;
  documentId: string;
  content: string;
  source: string;
  score: number;
}

// Usage 信息
interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// 流式消息状态
export interface StreamMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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

// Chat Request
export interface ChatRequest {
  question: string;
  sessionId?: string;
  knowledgeBaseId?: string;
  stream?: boolean;
}
```

- [ ] **Step 2: Add RAGStreamProvider class**

Continue writing the file:

```typescript
export class RAGStreamProvider extends AbstractChatProvider<
  StreamMessage,
  ChatRequest,
  string
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
```

- [ ] **Step 3: Add transformMessage method**

```typescript
  transformMessage(info: TransformMessage<StreamMessage, string>): StreamMessage {
    const { originMessage, chunk } = info;

    // 解析 SSE 事件
    const event = this.parseSSEEvent(chunk);

    if (!originMessage) {
      // 初始化助手消息
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
```

- [ ] **Step 4: Add SSE parsing helper**

```typescript
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
```

- [ ] **Step 5: Add event handler**

```typescript
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
```

- [ ] **Step 6: Add factory function**

```typescript
/**
 * 创建 RAGStreamProvider 实例
 */
export const createRAGStreamProvider = (apiUrl: string, token: string) => {
  return new RAGStreamProvider({ apiUrl, token });
};
```

- [ ] **Step 7: Verify complete provider file**

Read the file to confirm all methods and interfaces are defined correctly

---

## Task 10: Frontend - Update ChatPage

**Files:**
- Modify: `apps/frontend/src/pages/Chat/index.tsx`

- [ ] **Step 1: Replace imports**

Replace existing imports (lines 1-9) with:

```typescript
/**
 * 聊天页面 - 智能回答
 * 支持两阶段流式输出、实时思考展示、引用标注
 */
import React, { useMemo, useState, useCallback } from 'react';
import { useXChat } from '@ant-design/x-sdk';
import { Bubble, Sender } from '@ant-design/x';
import { createRAGStreamProvider, StreamMessage } from '@/providers/RAGStreamProvider';
import { ThinkingCard } from '@/components/ThinkingCard';
import { Citation } from '@/components/Citation';
import { CitationPanel, CitationItem } from '@/components/CitationPanel';
import { FeedbackButton } from '@/components/FeedbackButton';
import './index.css';
```

- [ ] **Step 2: Replace provider creation**

Replace the provider useMemo block (lines 16-21) with:

```typescript
  // 创建 RAG Stream Provider
  const provider = useMemo(() => {
    const apiUrl = `${
      import.meta.env.VITE_API_URL || 'http://localhost:3000'
    }/api/v1/chat/stream`;
    const token = localStorage.getItem('token') || '';
    return createRAGStreamProvider(apiUrl, token);
  }, []);
```

- [ ] **Step 3: Add citation panel state**

Add after the provider useMemo:

```typescript
  // 引用面板状态
  const [citationPanelOpen, setCitationPanelOpen] = useState(false);
  const [currentCitations, setCurrentCitations] = useState<CitationItem[]>([]);
```

- [ ] **Step 4: Replace handleSubmit**

Replace the handleSubmit function (lines 29-47) with:

```typescript
  // 发送消息
  const handleSubmit = (content: string) => {
    if (!content.trim() || isRequesting) return;

    onRequest({
      question: content,
    });
  };
```

- [ ] **Step 5: Add citation click handler**

Add after handleSubmit:

```typescript
  // 显示引用面板
  const handleCitationClick = useCallback((citations: CitationItem[]) => {
    setCurrentCitations(citations);
    setCitationPanelOpen(true);
  }, []);
```

- [ ] **Step 6: Add citation rendering function**

Add after handleCitationClick:

```typescript
  // 渲染带引用标记的内容
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
```

- [ ] **Step 7: Replace Bubble.List rendering**

Replace the entire Bubble.List items (lines 56-72) with:

```typescript
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
```

- [ ] **Step 8: Add CitationPanel**

Add before closing `</div>` of chat-page (after Sender):

```typescript
      {/* 引用来源面板 */}
      <CitationPanel
        open={citationPanelOpen}
        onClose={() => setCitationPanelOpen(false)}
        citations={currentCitations}
      />
```

- [ ] **Step 9: Verify complete ChatPage**

Read the file to confirm all changes are properly integrated

---

## Task 11: Frontend - Test Integration

**Files:**
- None (manual testing)

- [ ] **Step 1: Start frontend dev server**

Run: `pnpm dev:frontend`
Wait for Vite to start on port 5173

- [ ] **Step 2: Open chat page in browser**

Navigate to: `http://localhost:5173/chat`
Expected: Chat interface loads with input field

- [ ] **Step 3: Test retrieval scenario**

Type: "报销流程是什么？"
Press Enter
Expected:
- ThinkingCard appears showing "正在检索..."
- ThinkingCard updates with searchQuery, resultCount, topScore
- Answer streams in with citation markers [1], [2]
- FeedbackButton appears at bottom

- [ ] **Step 4: Test citation click**

Click on a citation marker [1]
Expected: CitationPanel opens on right side showing citation details

- [ ] **Step 5: Test no results scenario**

Type: "如何造火箭？"
Expected: ThinkingCard shows "找到 0 条结果", message: "知识库中未找到相关信息"

- [ ] **Step 6: Test no tool calling**

Type: "你好"
Expected: ThinkingCard shows "基于通用知识回答", no retrieval phase

- [ ] **Step 7: Commit frontend changes**

```bash
git add apps/frontend/src/providers/RAGStreamProvider.ts apps/frontend/src/pages/Chat/index.tsx
git commit -m "feat(frontend): integrate intelligent answering with RAGStreamProvider

- Create RAGStreamProvider to parse two-phase SSE events
- Update ChatPage to render thinking card and citations
- Add citation click interaction with CitationPanel
- Support real-time streaming display with citation markers"
```

---

## Task 12: Final Integration Test

**Files:**
- None (end-to-end testing)

- [ ] **Step 1: Run full stack**

Run: `pnpm dev` (starts both backend and frontend)
Wait for both services to be ready

- [ ] **Step 2: Complete user journey test**

1. Open chat page
2. Ask question: "公司的报销流程是什么？"
3. Verify ThinkingCard appears during retrieval
4. Verify answer streams with [1], [2] markers
5. Click citation marker [1]
6. Verify CitationPanel opens with full citation details
7. Check FeedbackButton appears and is clickable

- [ ] **Step 3: Verify database records**

Run: `pnpm db:studio`
Check:
- ChatSession created with correct title
- ChatMessage records for user and assistant
- Assistant message has toolCalls and references JSON
- tokensUsed and latencyMs recorded

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: complete intelligent answering implementation

Backend:
- Two-phase SSE protocol with thinking/citations/content/done events
- Tool Calling integration for knowledge base retrieval
- Citation-aware prompt engineering

Frontend:
- RAGStreamProvider for custom SSE parsing
- Real-time ThinkingCard display during retrieval
- Citation markers with interactive CitationPanel
- Feedback integration with chatMessageId

Testing:
- Verified successful retrieval scenarios
- Verified no results and no tool calling scenarios
- Database records correctly saved"
```

---

## Self-Review Checklist

After completing all tasks, verify:

**Spec Coverage:**
- ✅ Two-phase streaming protocol implemented (Tasks 1-7)
- ✅ SSE custom event format (phase, thinking, citations, content, done) (Tasks 1-5)
- ✅ Thinking info display with searchQuery, resultCount, topScore (Tasks 2, 9)
- ✅ Citation markers in answer text with [1], [2] format (Tasks 4, 7)
- ✅ CitationPanel interaction on click (Tasks 10, 11)
- ✅ FeedbackButton integration with chatMessageId (Tasks 5, 10)
- ✅ Tool Calling decision logic (rely on LLM) (Task 5)
- ✅ No results handling (show 0 results) (Task 2)

**Placeholder Scan:**
- ✅ No TBD/TODO comments
- ✅ All code shown in steps (no "implement similar to")
- ✅ All helper methods defined before use
- ✅ All imports and interfaces defined

**Type Consistency:**
- ✅ ThinkingEvent interface matches backend buildThinkingInfo return
- ✅ CitationItem interface matches backend buildCitations return
- ✅ StreamMessage interface matches frontend usage
- ✅ ChatRequest interface consistent across backend and frontend

**Plan saved to:** `docs/superpowers/plans/2026-03-30-intelligent-answering.md`