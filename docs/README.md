# 项目文档索引

**更新时间**: 2026-03-23

---

## 📋 文档列表

| 序号 | 文档名称 | 文档类型 | 创建日期 | 链接 |
|------|----------|----------|----------|------|
| 001 | RAG 系统产品需求文档 | PRD | 2026-03-23 | [001-rag-system-product-requirements.md](./001-rag-system-product-requirements.md) |
| 002 | RAG 系统技术方案设计 | Technical Design | 2026-03-23 | [002-rag-system-technical-design.md](./002-rag-system-technical-design.md) |
| 003 | RAG 系统部署指南 | Deployment | 2026-03-23 | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| 004 | Qdrant 向量数据库配置 | Setup | 2026-03-23 | [QDRANT_SETUP.md](./QDRANT_SETUP.md) |
| 005 | Knowledge Base Tool Calling 设计方案 | Technical Design | 2026-03-28 | [superpowers/specs/2026-03-28-knowledge-base-tool-calling-design.md](./superpowers/specs/2026-03-28-knowledge-base-tool-calling-design.md) |
| 006 | Knowledge Base Tool Calling 实现计划 | Implementation Plan | 2026-03-28 | [superpowers/plans/2026-03-28-knowledge-base-tool-calling.md](./superpowers/plans/2026-03-28-knowledge-base-tool-calling.md) |

---

## 📁 文档规范

### 命名规则
- ✅ 格式：`序号 - 文档名称.md`
- ✅ 序号从 001 开始，三位数编号
- ✅ 所有文档平铺在 `docs/` 目录下，**不创建子文件夹**
- ✅ 每个文档开头标注文档类型（PRD / Technical Design / Test Plan）

### 文档类型
- **PRD**: 产品需求文档
- **Technical Design**: 技术设计方案
- **Test Plan**: 测试计划与用例
- **Other**: 其他文档

### 新增文档流程
1. 查看 `docs/` 目录下现有最大序号
2. 新序号 = 最大序号 + 1
3. 命名：`XXX-文档名称.md`
4. 更新本索引表格

---

## ⚠️ 重要规则

**所有项目相关文档必须存放在项目目录的 `docs/` 文件夹下！**

- ❌ 禁止将文档散落在工作区其他位置
- ✅ 统一存放在 `/Users/daniel/Desktop/openclaw-projects/rag-system/docs/`
- ✅ 保持文档命名规范一致
- ✅ 及时更新本索引表格

---

## 🔗 相关资源

- [开发状态报告](../DEV_STATUS.md)
- [项目 README](../README.md)
- [Monorepo 架构](./MONOREPO.md)

---

**维护者**: 软件开发小组
