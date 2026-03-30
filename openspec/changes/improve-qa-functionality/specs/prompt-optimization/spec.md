## ADDED Requirements

### Requirement: System Prompt 优化

系统 SHALL 使用优化后的 System Prompt 引导 LLM 生成更准确、透明的答案。

#### Scenario: 引用标记生成
- **WHEN** LLM 基于检索结果生成答案
- **THEN** 在引用知识库内容的句末添加 `[1]`、`[2]` 等标记

#### Scenario: 无结果时的诚实回答
- **WHEN** 知识库检索返回空结果
- **THEN** LLM 明确告知"知识库中没有相关信息"，可选择基于内置知识补充

#### Scenario: 多轮对话引导
- **WHEN** 用户追问涉及前文内容
- **THEN** LLM 正确理解上下文，不重复检索已讨论内容

#### Scenario: 复杂问题拆解
- **WHEN** 用户提出包含多个子问题的复杂问题
- **THEN** LLM 分别回答每个子问题，分别标注引用

### Requirement: Rerank 参数优化

系统 SHALL 使用优化后的 Rerank 参数提升检索质量。

#### Scenario: topK 调整
- **WHEN** 执行检索
- **THEN** 初始检索返回 topK * 2 = 16 条结果供 Rerank 筛选

#### Scenario: Rerank 阈值过滤
- **WHEN** Rerank 完成后
- **THEN** 过滤掉 Rerank 分数低于 0.5 的结果

#### Scenario: 动态相似度阈值
- **WHEN** 查询长度超过 20 字
- **THEN** 自动降低相似度阈值至 0.25（长查询更难匹配）

#### Scenario: Rerank 失败降级
- **WHEN** Rerank 服务不可用
- **THEN** 使用原始向量检索分数，不阻断检索流程
