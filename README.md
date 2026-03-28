# RAG System - 智能知识库问答系统

基于 Node.js + TypeScript 的企业级 RAG（检索增强生成）系统。

**🏗️ Monorepo 架构**: 使用 pnpm workspace 统一管理后端、前端和微服务。

---

## 🚀 快速开始

### 前置要求

- Node.js 20+
- pnpm 8+
- Docker Desktop

### 一键启动

```bash
# 1. 安装依赖（根目录）
pnpm install

# 2. 启动基础设施
pnpm docker:infra

# 3. 启动所有应用服务（并行）
pnpm dev
```

访问：
- 前端：http://localhost:5173
- 后端 API: http://localhost:3000
- API 文档：http://localhost:3000/api/docs

## 🚀 技术栈

### 后端
- **框架**: NestJS 10 + TypeScript
- **数据库**: PostgreSQL 15 + Prisma ORM
- **向量库**: Milvus 2.4
- **缓存/队列**: Redis 7 + Bull
- **对象存储**: MinIO

### 前端
- **框架**: React 18 + Vite + TypeScript
- **UI 组件**: Ant Design 5
- **图表**: ECharts

### AI 服务
- **Embedding**: BGE-Large-ZH-v1.5 (TypeScript)
- **Rerank**: BGE-Reranker-Large (TypeScript)
- **LLM**: 通义千问 Qwen3.5-plus

---

## 📦 快速开始

### 前置要求
- Docker Desktop (包含 Docker Compose)
- Node.js 20+ (本地开发)
- pnpm (推荐使用)
- 外部服务：PostgreSQL, Milvus, Redis, MinIO (可通过 Docker 启动)

### 方式一：使用 Monorepo 命令（推荐）

```bash
# 1. 进入项目目录
cd rag-system

# 2. 安装所有依赖（根目录）
pnpm install

# 3. 复制环境变量文件
cp .env.example .env

# 4. 启动基础设施
pnpm docker:infra

# 5. 启动所有应用服务（并行）
pnpm dev

# 6. 运行数据库迁移
pnpm db:migrate
pnpm db:seed

# 7. 访问应用
# 前端：http://localhost:5173
# 后端 API: http://localhost:3000
# API 文档：http://localhost:3000/api/docs
```

### 方式二：分别启动

```bash
# 1. 启动基础设施
pnpm docker:infra

# 2. 新终端启动后端
pnpm dev:backend

# 3. 新终端启动前端
pnpm dev:frontend

# 4. 新终端启动 Embedding
pnpm dev:embedding
```

---

## 📁 项目结构

```
rag-system/
├── package.json              # 根配置 (workspace)
├── pnpm-workspace.yaml       # workspace 定义
├── .npmrc                    # pnpm 配置
│
├── apps/                     # 应用服务
│   ├── backend/             # NestJS 后端 API
│   │   ├── prisma/         # 数据库 Schema
│   │   ├── src/            # 源代码
│   │   └── package.json
│   ├── frontend/            # React 前端
│   │   ├── src/            # 源代码
│   │   └── package.json
│   └── embedding/           # Embedding 微服务
│       ├── src/            # 源代码
│       └── package.json
│
├── docs/                     # 项目文档
├── scripts/                  # 脚本工具
├── docker-compose.yml        # 前后端部署
├── docker-compose.infra.yml  # 基础设施部署
├── .env.example              # 环境变量模板
└── README.md                 # 本文件
```

---

## 🔧 开发指南

### 后端开发

```bash
cd backend

# 安装依赖
pnpm install

# 生成 Prisma Client
pnpm prisma generate

# 数据库迁移
pnpm prisma migrate dev --name init

# 启动开发服务器
pnpm run dev

# 运行测试
pnpm test
```

### 前端开发

```bash
cd frontend

# 安装依赖
pnpm install

# 启动开发服务器
pnpm run dev
```

### Embedding 服务开发

```bash
cd services/embedding

# 安装依赖
pnpm install

# 启动开发服务器
pnpm run dev
```

### 数据库操作

```bash
cd backend

# 查看迁移历史
pnpm prisma migrate status

# 重置数据库（开发环境）
pnpm prisma migrate reset

# 打开 Prisma Studio（可视化数据库）
pnpm prisma studio

# 插入种子数据
pnpm prisma db seed
```

---

## 📝 API 文档

启动后访问：http://localhost:3000/api/docs

### 核心接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/auth/login` | 用户登录 |
| POST | `/api/v1/auth/register` | 用户注册 |
| POST | `/api/v1/chat` | 发送问题（非流式，支持 Tool Calling 智能检索） |
| POST | `/api/v1/chat/stream` | 发送问题（SSE 流式，支持 Tool Calling 智能检索） |
| POST | `/api/v1/feedback` | 提交反馈 |
| GET | `/api/v1/knowledge-bases` | 获取知识库列表 |
| POST | `/api/v1/knowledge-bases/:id/documents` | 上传文档到知识库 |
| GET | `/api/v1/knowledge-bases/:id/documents` | 获取文档列表 |
| DELETE | `/api/v1/documents/:id` | 删除文档 |

---

## 🎯 默认账号

开发环境启动后会自动创建默认管理员账号：

- **用户名**: `admin`
- **密码**: `admin123`
- **角色**: `admin`

⚠️ **生产环境请务必修改默认密码！**

---

## 📊 监控

### 服务健康检查

```bash
# 后端健康
curl http://localhost:3000/health

# Embedding 服务健康
curl http://localhost:8001/health

# 查看 Docker 服务状态
docker-compose ps
```

### 日志查看

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看后端日志
docker-compose logs -f api

# 查看前端日志
docker-compose logs -f web

# 查看 Embedding 服务日志
cd services/embedding && pnpm run dev
```

---

## 🚀 生产部署

详见 [部署文档](./docs/DEPLOYMENT.md)

### 关键步骤

```bash
# 1. 配置生产环境变量
cp .env.example .env.production
# 编辑 .env.production，配置生产服务地址

# 2. 构建生产镜像
docker-compose -f docker-compose.prod.yml build

# 3. 部署
docker-compose -f docker-compose.prod.yml up -d

# 4. 运行迁移
docker-compose -f docker-compose.prod.yml run --rm api pnpm prisma migrate deploy
```

---

## 📄 文档

- [产品需求文档](./docs/001-rag-system-product-requirements.md)
- [技术方案设计](./docs/002-rag-system-technical-design.md)
- [部署指南](./docs/DEPLOYMENT.md)
- [Knowledge Base Tool Calling 设计方案](./docs/superpowers/specs/2026-03-28-knowledge-base-tool-calling-design.md)
- [Knowledge Base Tool Calling 实现计划](./docs/superpowers/plans/2026-03-28-knowledge-base-tool-calling.md)
- [API 文档](http://localhost:3000/api/docs)

---

## 🤖 Tool Calling 智能检索

系统采用基于 Tool Calling 的智能知识库检索功能：

### 工作原理

1. **智能判断**: LLM 自动判断问题是否需要检索知识库
2. **Tool 调用**: 需要检索时自动调用 `knowledge_base_search` tool
3. **结果增强**: 基于检索结果生成准确答案，并注明来源
4. **降级处理**: 知识库无结果时使用 LLM 内置知识回答

### 适用场景

| 问题类型 | 行为 |
|----------|------|
| 知识库相关问题（如"报销流程"） | 调用 tool 检索知识库 |
| 常识性问题（如"什么是 AI"） | 直接回答，不调用 tool |
| 问候语（如"你好"） | 直接回答，不调用 tool |
| 知识库无相关信息 | 明确告知用户，可能补充内置知识 |

### 技术实现

- **Vercel AI SDK**: `generateText` / `streamText` with `tools` parameter
- **Zod**: Tool parameters schema 定义
- **自动循环**: tool call → execute → continue generation
- **元数据记录**: tool calling 记录保存到数据库

---

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📝 开发规范

### Git 提交规范 (Conventional Commits)

```
feat: 新功能
fix: Bug 修复
docs: 文档更新
style: 代码格式（不影响功能）
refactor: 重构
test: 测试相关
chore: 构建/工具/配置
```

### 代码规范

- 后端：ESLint + Prettier
- 前端：ESLint + Prettier
- 数据库：Prisma Schema

---

## ⚠️ 注意事项

1. **环境变量**: 不要将 `.env` 文件提交到 Git
2. **默认密码**: 生产环境务必修改默认管理员密码
3. **API Key**: LLM API Key 请妥善保管
4. **数据备份**: 定期备份 PostgreSQL 和 Milvus 数据
5. **外部服务**: 确保 PostgreSQL/Milvus/Redis/MinIO 服务可访问

---

## 📞 问题反馈

遇到问题请提交 Issue 或联系开发团队。

---

## 📜 许可证

MIT License

---

**开发团队**: 软件开发小组
**最后更新**: 2026-03-28
