## Context

当前 RAG 系统的知识问答功能基于 Tool Calling 架构实现了基础的智能检索能力。核心流程为：用户提问 → LLM 判断是否调用 `knowledge_base_search` tool → 检索服务执行向量搜索 + Rerank → LLM 基于检索结果生成答案。

**现状分析**：
- **检索质量**：当前使用 BGE-Reranker-Large 进行重排序，但参数配置未经调优
- **引用展示**：数据库已记录 `references` 字段，但前端未展示来源信息
- **多轮对话**：历史消息仅传递最近 6 条，缺乏指代消解和上下文理解
- **用户反馈**：无反馈收集机制，无法评估答案质量和持续优化
- **可解释性**：用户无法看到 LLM 的思考过程（是否检索、检索词等）

**约束条件**：
- 保持现有 Tool Calling 架构不变
- 不替换 LLM 和 Embedding 模型
- 兼容现有数据库结构（可新增表，避免破坏性变更）

## Goals / Non-Goals

**Goals:**
1. 提升答案准确性（优化 Rerank 参数、Prompt 工程）
2. 实现引用来源标注（前端展示 + 跳转）
3. 支持多轮对话优化（上下文理解、指代消解）
4. 建立用户反馈系统（收集、查看、处理）
5. 增强可解释性（展示思考过程和检索元数据）

**Non-Goals:**
1. 不改变 Tool Calling 核心架构
2. 不替换当前 LLM/Embedding 模型
3. 不涉及知识库管理功能
4. 不重构现有聊天 API 基础接口

## Decisions

### Decision 1: 引用标注实现方案

**方案 A（采用）**：后端在生成答案时返回引用元数据，前端在答案中插入可点击的上标链接
- **优点**：实现简单、用户体验好、来源清晰
- **缺点**：需要 LLM 配合生成引用标记

**方案 B**：前端根据返回的 references 字段自行渲染来源卡片
- **优点**：前端控制灵活
- **缺点**：无法精确对应答案中的具体引用位置

**决策**：采用方案 A + 方案 B 结合。LLM 生成答案时在句末添加 `[1]` 格式的引用标记，后端解析标记并关联 references，前端渲染为可点击的上标，悬停显示来源详情，点击展开文档预览。

### Decision 2: 多轮对话优化策略

**方案 A（采用）**：在 System Prompt 中增加上下文理解引导，传递更长的历史消息（10-12 条）
- **优点**：实现成本低、效果明显
- **缺点**：增加 token 消耗

**方案 B**：引入独立的 Query Rewriting 模块，将追问改写为完整问题
- **优点**：更精准的意图识别
- **缺点**：需要额外的模型调用和延迟

**决策**：先采用方案 A 快速上线，后续根据数据考虑引入方案 B。当前将历史消息从 6 条扩展到 12 条，在 System Prompt 中增加指代消解引导。

### Decision 3: 反馈系统设计

**数据模型**：
```prisma
model Feedback {
  id          String   @id @default(cuid())
  messageId   String   // ChatMessage.id
  userId      String
  rating      Int      // 1=点踩，2=点赞
  comment     String?  // 可选文字反馈
  tags        String[] // 反馈标签：["不准确", "不完整", "来源错误"]
  status      String   // pending/resolved/ignored
  resolvedAt  DateTime?
  resolvedBy  String?
  createdAt   DateTime @default(now())

  @@index([messageId])
  @@index([userId])
}
```

**决策**：
- 简单评分（1-5 星）+ 可选文字反馈
- 预设标签快速选择（不准确、不完整、来源错误、其他）
- 管理员后台查看和处理反馈
- 反馈与 ChatMessage 关联，支持追溯分析

### Decision 4: 思考过程展示

**展示内容**：
- 是否调用了知识库检索
- 检索关键词（提取自 tool args）
- 检索结果数量和最髙相似度分数
- 是否命中 Rerank

**技术方案**：
- 后端从 `toolCalls` 元数据中提取信息
- 在响应中新增 `thinking` 字段
- 前端在消息气泡下方以折叠卡片展示

### Decision 5: Rerank 参数优化

**当前配置**：
- topK: 5（检索 5 条结果）
- similarityThreshold: 0.3

**优化方案**：
- topK: 调整为 8（检索更多结果供 Rerank 筛选）
- similarityThreshold: 动态阈值（根据查询长度和类型调整）
- 增加 Rerank 阈值过滤（Rerank 后分数低于 0.5 的结果不传给 LLM）

**实验计划**：
- A/B 测试不同参数组合
- 收集用户反馈评估效果

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM 不按要求生成引用标记 | 中 | Prompt 工程优化 + 少样本示例 + 后端兜底处理 |
| 增加历史消息导致 token 超量 | 低 | 限制 12 条 + 截断长消息 + 监控 token 使用 |
| Rerank 参数调整导致召回率下降 | 中 | 小流量测试 + 反馈数据监控 + 快速回滚 |
| 反馈系统被滥用（恶意差评） | 低 | 登录用户才能反馈 + 频率限制 + 异常检测 |
| 思考过程暴露系统实现细节 | 低 | 仅展示高层元数据 + 不暴露向量/分数细节 |

## Migration Plan

### 数据库迁移
```bash
# 1. 创建 Feedback 表
pnpm db:migrate

# 2. 验证迁移
pnpm prisma migrate status
```

### 后端部署
1. 部署新版后端服务（包含所有改动）
2. 验证健康检查：`curl http://localhost:3000/health`
3. 验证 API 文档：访问 `/api/docs`

### 前端部署
1. 部署新版前端应用
2. 验证聊天页面功能

### 回滚策略
- 数据库：Prisma migrate down 回滚
- 应用：Docker 镜像回滚到上一版本
- 配置：环境变量开关控制新功能启用

## Open Questions

1. **引用标记格式**：使用 `[1]` 还是 `¹` 上标数字？
   - 倾向：`[1]`（兼容性更好，易于解析）

2. 反馈评分采用 1-5 星还是简单点赞/点踩？
   - 倾向：1-5 星（更细粒度，但可能增加用户操作成本）

3. 多轮对话历史传递多少条合适？
   - 倾向：12 条（平衡上下文理解和 token 成本）

4. 是否需要反馈通知机制？
   - 待讨论：当反馈被处理时是否通知用户
