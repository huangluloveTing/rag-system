# RAG 系统技术方案设计

**文档类型**: Technical Design  
**创建日期**: 2026-03-23  
**最后更新**: 2026-03-23  
**版本**: v1.1  
**关联 PRD**: [001-rag-system-product-requirements.md](./001-rag-system-product-requirements.md)

---

## 📝 变更日志

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.1 | 2026-03-23 | 后端改为 Node.js + TypeScript，补充数据库迁移脚本规范 |
| v1.0 | 2026-03-23 | 初始版本 (Python FastAPI) |

---

## 1. 架构设计

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户层                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │  Web 端   │  │  API 调用  │  │  IM 集成   │ (飞书/钉钉/微信)        │
│  └──────────┘  └──────────┘  └──────────┘                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         网关层                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Nginx / API Gateway (限流/认证/路由/日志)                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       应用服务层                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 问答服务    │  │ 文档服务    │  │ 用户服务    │             │
│  │ (Q&A API)   │  │ (Doc API)   │  │ (Auth API)  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│  ┌─────────────┐  ┌─────────────┐                              │
│  │ 监控服务    │  │ 反馈服务    │                              │
│  │ (Monitor)   │  │ (Feedback)  │                              │
│  └─────────────┘  └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       核心引擎层                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 检索引擎    │  │ Rerank 引擎  │  │ 生成引擎    │             │
│  │ (Retriever) │  │ (Reranker)  │  │ (LLM)       │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│  ┌─────────────┐  ┌─────────────┐                              │
│  │ 文档解析器  │  │ 向量化引擎  │                              │
│  │ (Parser)    │  │ (Embedding) │                              │
│  └─────────────┘  └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       数据存储层                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 向量数据库  │  │ 关系数据库  │  │ 对象存储    │             │
│  │ (Milvus)    │  │ (PostgreSQL)│  │ (MinIO/S3)  │             │
│  │ - 文档片段   │  │ - 用户/权限 │  │ - 原始文件   │             │
│  │ - Embedding │  │ - 文档元数据│  │ - 缩略图     │             │
│  │ - 索引      │  │ - 日志/反馈 │  │              │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

### 1.2 模块划分

| 模块 | 职责 | 技术选型 |
|------|------|----------|
| **Web 前端** | 用户界面、问答交互、文档管理 | React 18 + Ant Design 5 + TypeScript |
| **API 网关** | 请求路由、认证鉴权、限流熔断 | Nginx + Kong / APISIX |
| **问答服务** | 处理用户提问、调用检索/生成引擎 | Node.js 20 + NestJS + TypeScript |
| **文档服务** | 文档上传、解析、分块、索引构建 | Node.js 20 + Bull (队列) |
| **用户服务** | 用户认证、权限管理、角色控制 | Node.js 20 + JWT |
| **检索引擎** | 向量相似度搜索、混合检索 | Milvus + Elasticsearch |
| **Rerank 引擎** | 检索结果重排序 | bge-reranker-large (Python 微服务) |
| **生成引擎** | LLM 调用、Prompt 管理、答案生成 | LangChain.js + 通义千问 API |
| **文档解析器** | PDF/Word/Markdown 解析 | pdf-parse + mammoth + markdown-it |
| **向量化引擎** | 文本 Embedding 生成 | bge-large-zh-v1.5 (Python 微服务) |
| **向量数据库** | 向量存储与检索 | Milvus 2.4+ |
| **关系数据库** | 元数据、用户、日志存储 | PostgreSQL 15+ |
| **对象存储** | 原始文件存储 | MinIO (私有化) / AWS S3 |

---

### 1.3 数据流说明

#### 1.3.1 文档入库流程

```
用户上传文档
    │
    ▼
文档服务接收文件 → 存储到对象存储 (MinIO/S3)
    │
    ▼
异步任务 (Bull Queue) 解析文档
    │
    ├── PDF → pdf-parse 提取文本
    ├── Word → mammoth 提取文本
    └── Markdown/TXT → 直接读取
    │
    ▼
文本分块 (Chunking)
    │
    ├── 按段落/标题边界切分
    ├── Chunk 大小：500 tokens
    └── 重叠：100 tokens
    │
    ▼
向量化引擎生成 Embedding
    │
    ├── Node.js 调用 Python 微服务
    └── HTTP/gRPC 传递文本，返回向量
    │
    ▼
写入向量数据库 (Milvus)
    │
    ├── 向量：Embedding(1024 维)
    ├── 元数据：doc_id, chunk_id, content, page, source
    └── 索引：HNSW
    │
    ▼
写入关系数据库 (PostgreSQL)
    │
    ├── 文档元数据：文件名、大小、上传人、时间
    └── 索引状态：已索引/处理中/失败
    │
    ▼
完成，可检索
```

#### 1.3.2 问答流程

```
用户提问
    │
    ▼
问答服务接收问题
    │
    ▼
查询改写 (可选)
    │
    ├── 同义词扩展
    └── 问题分解
    │
    ▼
检索引擎 - 向量检索 (Milvus)
    │
    ├── Top-50 候选
    └── 相似度阈值 > 0.3
    │
    ▼
检索引擎 - 关键词检索 (Elasticsearch)
    │
    └── BM25 Top-50
    │
    ▼
混合检索融合 (RRF)
    │
    └── Reciprocal Rank Fusion
    │
    ▼
Rerank 引擎精排
    │
    ├── bge-reranker-large
    └── 取 Top-5
    │
    ▼
构建 Prompt
    │
    ├── 系统指令
    ├── 检索到的上下文 (Top-5 chunks)
    └── 用户问题
    │
    ▼
生成引擎 - LLM 调用
    │
    └── 通义千问 Qwen3.5-plus
    │
    ▼
后处理
    │
    ├── 提取引用标注
    ├── 敏感词过滤
    └── 格式化输出
    │
    ▼
返回答案 + 引用来源
    │
    ▼
记录日志 (PostgreSQL)
```

---

## 2. 技术选型

### 2.1 核心技术栈

| 层级 | 技术 | 版本 | 选型理由 |
|------|------|------|----------|
| **前端框架** | React | 18.x | 生态成熟、组件丰富、团队熟悉 |
| **UI 组件库** | Ant Design | 5.x | 企业级 UI、中文友好、主题定制 |
| **后端框架** | NestJS | 10.x | TypeScript 优先、模块化、依赖注入、生态完善 |
| **运行时** | Node.js | 20.x (LTS) | 高性能、异步 I/O、团队熟悉 |
| **包管理器** | pnpm | 8.x | 快速、节省磁盘空间、依赖去重 |
| **任务队列** | Bull + Redis | 4.x | Node.js 原生、支持延迟队列、成熟稳定 |
| **ORM** | Prisma | 5.x | TypeScript 类型安全、自动迁移、开发体验好 |
| **向量数据库** | Milvus | 2.4+ | 开源、高性能、支持 HNSW 索引、中文文档齐全 |
| **关系数据库** | PostgreSQL | 15+ | 支持 pgvector 扩展、JSONB、成熟稳定 |
| **搜索引擎** | Elasticsearch | 8.x | BM25 关键词检索、混合检索必备 |
| **对象存储** | MinIO | 最新版 | S3 兼容、私有化部署、轻量 |
| **Embedding 模型** | bge-large-zh-v1.5 | - | 中文效果优秀、开源免费、可本地部署 |
| **Rerank 模型** | bge-reranker-large | - | 中文 Rerank SOTA、显著提升准确率 |
| **LLM** | 通义千问 Qwen3.5-plus | API | 中文能力强、Token 成本低、稳定 |
| **应用编排** | LangChain.js | 0.1+ | RAG 标准组件、Prompt 管理、易扩展 |
| **容器化** | Docker + Compose | - | 快速部署、环境隔离 |
| **监控** | Prometheus + Grafana | - | 指标采集、可视化、告警 |

---

### 2.2 备选方案

| 组件 | 首选 | 备选 1 | 备选 2 |
|------|------|--------|--------|
| 向量数据库 | Milvus | Qdrant | Chroma (MVP) |
| Embedding | bge-large-zh | m3e-base | text2vec |
| LLM | Qwen3.5-plus | GLM-4 | ChatGLM3 |
| 后端框架 | NestJS | Express | Koa |
| ORM | Prisma | TypeORM | Drizzle |
| 前端框架 | React | Vue 3 | Next.js |

---

## 3. 接口设计

### 3.1 API 概览

| 模块 | 方法 | 路径 | 描述 |
|------|------|------|------|
| **问答** | POST | `/api/v1/chat` | 发送问题，获取答案 |
| **问答** | POST | `/api/v1/chat/stream` | 流式输出答案 |
| **问答** | GET | `/api/v1/chat/history/{session_id}` | 获取对话历史 |
| **文档** | POST | `/api/v1/documents/upload` | 上传文档 |
| **文档** | GET | `/api/v1/documents` | 文档列表 |
| **文档** | GET | `/api/v1/documents/{id}` | 文档详情 |
| **文档** | DELETE | `/api/v1/documents/{id}` | 删除文档 |
| **文档** | POST | `/api/v1/documents/{id}/reindex` | 重新索引 |
| **知识库** | POST | `/api/v1/knowledge-bases` | 创建知识库 |
| **知识库** | GET | `/api/v1/knowledge-bases` | 知识库列表 |
| **知识库** | PUT | `/api/v1/knowledge-bases/{id}` | 更新配置 |
| **用户** | POST | `/api/v1/auth/login` | 用户登录 |
| **用户** | POST | `/api/v1/auth/register` | 用户注册 |
| **用户** | GET | `/api/v1/users/me` | 当前用户信息 |
| **反馈** | POST | `/api/v1/feedback` | 提交反馈 (点赞/点踩) |
| **监控** | GET | `/api/v1/metrics/dashboard` | 监控仪表盘数据 |

---

### 3.2 核心接口定义

#### 3.2.1 问答接口

```yaml
POST /api/v1/chat
Content-Type: application/json
Authorization: Bearer {token}

Request:
{
  "question": "公司年假有多少天？",
  "session_id": "uuid-xxx",  # 可选，用于多轮对话
  "knowledge_base_id": "kb-xxx",  # 可选，指定知识库
  "stream": false,  # 是否流式输出
  "top_k": 5,  # 检索片段数量
  "similarity_threshold": 0.3  # 相似度阈值
}

Response (200 OK):
{
  "code": 0,
  "data": {
    "answer": "根据公司制度，员工年假为 5-15 天，具体根据工龄计算...",
    "references": [
      {
        "doc_id": "doc-001",
        "doc_name": "员工手册.pdf",
        "page": 12,
        "content": "员工年假规定：工龄 1-3 年 5 天，3-5 年 10 天...",
        "similarity": 0.89
      }
    ],
    "confidence": 0.85,  # 答案置信度
    "latency_ms": 1250,  # 响应时间
    "model": "qwen3.5-plus",
    "tokens_used": 450
  }
}
```

#### 3.2.2 文档上传接口

```yaml
POST /api/v1/documents/upload
Content-Type: multipart/form-data
Authorization: Bearer {token}

Request:
- file: (binary)  # 支持 PDF/DOCX/MD/TXT
- knowledge_base_id: "kb-xxx"  # 知识库 ID
- tags: ["制度", "人事"]  # 可选标签
- is_public: true  # 是否公开

Response (202 Accepted):
{
  "code": 0,
  "data": {
    "document_id": "doc-xxx",
    "status": "processing",  # processing/indexed/failed
    "message": "文档已接收，正在异步处理"
  }
}
```

#### 3.2.3 反馈接口

```yaml
POST /api/v1/feedback
Content-Type: application/json
Authorization: Bearer {token}

Request:
{
  "chat_id": "chat-xxx",  # 对话记录 ID
  "rating": 1,  # 1=点赞，-1=点踩
  "comment": "答案很准确"  # 可选，文字反馈
}

Response (200 OK):
{
  "code": 0,
  "data": {
    "feedback_id": "fb-xxx",
    "message": "感谢反馈"
  }
}
```

---

## 4. 数据库设计

### 4.1 Prisma Schema 定义

> **说明**: 使用 Prisma ORM 管理数据库 schema，所有表结构变更通过 Prisma Migrate 生成迁移脚本。

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 用户表
model User {
  id           String   @id @default(uuid()) @db.Uuid
  username     String   @unique @db.VarChar(50)
  email        String   @unique @db.VarChar(100)
  passwordHash String   @db.VarChar(255)
  role         String   @default("viewer") @db.VarChar(20) // admin/editor/viewer
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  documents          Document[]       @relation("DocumentCreator")
  knowledgeBases     KnowledgeBase[]
  chatSessions       ChatSession[]
  feedbacks          Feedback[]
  retrievalLogs      RetrievalLog[]
  
  @@index([username])
  @@index([email])
  @@map("users")
}

// 知识库表
model KnowledgeBase {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @db.VarChar(100)
  description String?
  config      Json?    // {chunkSize: 500, overlap: 100, embeddingModel: ...}
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  createdBy   String   @db.Uuid
  creator     User     @relation(fields: [createdBy], references: [id])
  
  documents   Document[]
  chatSessions ChatSession[]
  
  @@index([name])
  @@map("knowledge_bases")
}

// 文档表
model Document {
  id          String   @id @default(uuid()) @db.Uuid
  filename    String   @db.VarChar(255)
  filePath    String?  @db.VarChar(500) // 对象存储路径
  fileSize    BigInt?
  fileType    String?  @db.VarChar(20) // pdf/docx/markdown/txt
  contentHash String?  @db.VarChar(64) // 用于去重
  status      String   @default("pending") @db.VarChar(20) // pending/processing/indexed/failed
  errorMessage String?
  metadata    Json?    // {pages: 10, author: ..., uploadTime: ...}
  tags        String[]
  isPublic    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  knowledgeBaseId String @db.Uuid
  knowledgeBase   KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id])
  
  createdBy    String? @db.Uuid
  creator      User?   @relation("DocumentCreator", fields: [createdBy], references: [id])
  
  chunks       Chunk[]
  
  @@index([knowledgeBaseId])
  @@index([status])
  @@map("documents")
}

// 文档片段表 (Milvus 存储向量，PostgreSQL 存储元数据)
model Chunk {
  id        String   @id @default(uuid()) @db.Uuid
  chunkId   String   @unique @db.VarChar(64) // Milvus 中的主键
  docId     String   @db.Uuid
  document  Document @relation(fields: [docId], references: [id], onDelete: Cascade)
  content   String   @db.VarChar(8000)
  page      Int?
  chunkIndex Int
  metadata  Json?
  
  @@index([docId])
  @@map("chunks")
}

// 对话会话表
model ChatSession {
  id        String   @id @default(uuid()) @db.Uuid
  title     String?  @db.VarChar(200)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  userId        String @db.Uuid
  user          User   @relation(fields: [userId], references: [id])
  
  knowledgeBaseId String? @db.Uuid
  knowledgeBase   KnowledgeBase? @relation(fields: [knowledgeBaseId], references: [id])
  
  messages    ChatMessage[]
  
  @@index([userId])
  @@map("chat_sessions")
}

// 对话消息表
model ChatMessage {
  id         String   @id @default(uuid()) @db.Uuid
  role       String   @db.VarChar(20) // user/assistant
  content    String
  references Json?    // 引用的文档片段
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

// 反馈表
model Feedback {
  id        String   @id @default(uuid()) @db.Uuid
  rating    Int      // 1 or -1
  comment   String?
  createdAt DateTime @default(now())
  
  chatMessageId String @db.Uuid
  chatMessage   ChatMessage @relation(fields: [chatMessageId], references: [id])
  
  userId     String @db.Uuid
  user       User   @relation(fields: [userId], references: [id])
  
  @@index([chatMessageId])
  @@index([rating])
  @@map("feedbacks")
}

// 检索日志表
model RetrievalLog {
  id        String   @id @default(uuid()) @db.Uuid
  question  String
  retrievedDocs Json? // 检索到的文档 ID 列表
  latencyMs Int?
  createdAt DateTime @default(now())
  
  userId String? @db.Uuid
  user   User?   @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@index([createdAt])
  @@map("retrieval_logs")
}
```

---

### 4.2 数据库迁移脚本规范

> **原则**: 所有表结构变更必须通过 Prisma Migrate 生成迁移脚本，禁止手动修改数据库。

#### 4.2.1 目录结构

```
backend/
├── prisma/
│   ├── schema.prisma          # 数据库 schema 定义
│   ├── migrations/            # 迁移脚本目录
│   │   ├── 20260323000000_init/
│   │   │   ├── migration.sql  # 初始建表脚本
│   │   │   └── migration_lock.toml
│   │   └── 20260324000000_add_chunks_table/
│   │       ├── migration.sql
│   │       └── migration_lock.toml
│   └── seed.ts                # 种子数据脚本
├── src/
└── package.json
```

#### 4.2.2 迁移命令

```bash
# 开发环境：修改 schema.prisma 后生成迁移
pnpm prisma migrate dev --name add_chunks_table

# 生产环境：应用迁移（不生成新迁移）
pnpm prisma migrate deploy

# 查看迁移状态
pnpm prisma migrate status

# 重置数据库 (开发环境)
pnpm prisma migrate reset

# 生成 Prisma Client
pnpm prisma generate
```

#### 4.2.3 迁移脚本示例

```sql
-- migrations/20260323000000_init/migration.sql

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'viewer',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_users_username" ON "users"("username");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateTable
CREATE TABLE "knowledge_bases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "config" JSONB,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "knowledge_bases" 
ADD CONSTRAINT "knowledge_bases_created_by_fkey" 
FOREIGN KEY ("created_by") REFERENCES "users"("id") 
ON DELETE RESTRICT ON UPDATE CASCADE;
```

#### 4.2.4 迁移规范

| 场景 | 操作 |
|------|------|
| **新增表** | 修改 `schema.prisma` → `pnpm prisma migrate dev --name add_xxx_table` |
| **新增字段** | 修改 `schema.prisma` → 生成迁移 → 设置默认值（如需要） |
| **删除字段** | 修改 `schema.prisma` → 生成迁移 → 确认数据可丢失 |
| **修改字段类型** | 修改 `schema.prisma` → 生成迁移 → 手动审查 SQL（可能数据丢失） |
| **生产部署** | CI/CD 自动执行 `pnpm prisma migrate deploy` |
| **回滚迁移** | `pnpm prisma migrate resolve --rolled-back <migration_name>` |

#### 4.2.5 种子数据脚本

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 创建管理员账号
  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: adminPassword,
      role: 'admin',
      isActive: true,
    },
  });

  // 创建默认知识库
  await prisma.knowledgeBase.upsert({
    where: { name: '默认知识库' },
    update: {},
    create: {
      name: '默认知识库',
      description: '系统默认知识库',
      config: {
        chunkSize: 500,
        overlap: 100,
        embeddingModel: 'bge-large-zh-v1.5',
      },
      createdBy: (await prisma.user.findUnique({ where: { username: 'admin' } }))!.id,
    },
  });

  console.log('Seed data created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

### 4.3 Milvus 集合设计

```python
from pymilvus import DataType, FieldSchema, CollectionSchema

# 文档片段集合
fields = [
    FieldSchema(name="chunk_id", dtype=DataType.VARCHAR, max_length=64, is_primary=True),
    FieldSchema(name="doc_id", dtype=DataType.VARCHAR, max_length=64),
    FieldSchema(name="knowledge_base_id", dtype=DataType.VARCHAR, max_length=64),
    FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=8000),  # 文本内容
    FieldSchema(name="page", dtype=DataType.INT64),  # 页码
    FieldSchema(name="chunk_index", dtype=DataType.INT64),  # 第几个 chunk
    FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=1024),  # bge-large-zh 维度
    FieldSchema(name="metadata", dtype=DataType.JSON),  # 额外元数据
]

schema = CollectionSchema(fields, "RAG document chunks")
collection = Collection("rag_chunks", schema)

# 创建索引 (HNSW)
index_params = {
    "metric_type": "COSINE",
    "index_type": "HNSW",
    "params": {"M": 16, "efConstruction": 200}
}
collection.create_index("embedding", index_params)
```

---

## 5. 实现计划

### 5.1 任务拆解

| 阶段 | 任务 | 工时 (人天) | 依赖 |
|------|------|-------------|------|
| **Phase 1: 基础框架** | | **5 天** | |
| 1.1 | 项目初始化 (NestJS + React 脚手架) | 1 | - |
| 1.2 | Prisma Schema 设计与迁移脚本 | 1 | - |
| 1.3 | 用户认证模块 (JWT + Guard) | 1 | 1.2 |
| 1.4 | 文档上传接口 (MinIO 集成) | 2 | 1.2 |
| **Phase 2: 核心引擎** | | **7 天** | |
| 2.1 | 文档解析器 (pdf-parse + mammoth) | 2 | 1.4 |
| 2.2 | 文本分块与向量化 (调用 Python 服务) | 2 | 2.1 |
| 2.3 | Milvus 集成与索引构建 | 2 | 2.2 |
| 2.4 | 向量检索接口 | 1 | 2.3 |
| **Phase 3: 问答功能** | | **5 天** | |
| 3.1 | LLM 集成 (通义千问 API) | 1 | - |
| 3.2 | LangChain.js Prompt 管理 | 1 | 3.1 |
| 3.3 | 问答接口实现 (SSE 流式) | 2 | 2.4, 3.2 |
| 3.4 | 流式输出支持 (SSE) | 1 | 3.3 |
| **Phase 4: 前端开发** | | **5 天** | |
| 4.1 | 问答界面 (聊天 UI + 流式渲染) | 2 | 3.3 |
| 4.2 | 文档管理界面 (上传/列表/删除) | 2 | 1.4 |
| 4.3 | 监控仪表盘 (ECharts) | 1 | 3.3 |
| **Phase 5: 优化与测试** | | **5 天** | |
| 5.1 | 混合检索 (可选 ES 集成) | 2 | 2.4 |
| 5.2 | Rerank 集成 (调用 Python 服务) | 1 | 5.1 |
| 5.3 | 单元测试 (Jest) + 集成测试 | 2 | 全部 |
| **总计** | | **27 人天** | |

---

### 5.2 工时估算

- **开发**: 27 人天 ≈ 6 周 (单人) / 3 周 (2 人并行)
- **测试**: 5 人天 (可与开发重叠)
- **部署**: 2 人天
- **总计**: 约 7-8 周 (单人) / 4 周 (2 人团队)

---

### 5.3 依赖关系

```
Week 1-2: Phase 1 + Phase 2 (基础框架 + 核心引擎)
Week 3-4: Phase 3 + Phase 4 (问答功能 + 前端)
Week 5-6: Phase 5 (优化与测试)
Week 7:   部署上线 + 灰度
```

---

## 6. 技术风险

### 6.1 已识别风险

| 风险 | 概率 | 影响 | 应对方案 |
|------|------|------|----------|
| **Embedding 模型效果不佳** | 中 | 高 | 预测试 bge/m3e/text2vec，准备 A/B 测试 |
| **Milvus 性能瓶颈** | 中 | 中 | 压力测试，准备 HNSW 参数调优方案 |
| **LLM Token 成本超预算** | 高 | 中 | 上下文压缩、小模型初筛、缓存高频问题 |
| **文档解析失败率高** | 中 | 中 | 多解析器 fallback，人工审核队列 |
| **敏感信息泄露** | 低 | 高 | 权限过滤、内容审计、日志脱敏、定期审查 |

### 6.2 技术债务

- [ ] 初期用 Chroma 替代 Milvus (MVP 阶段)
- [ ] 暂不实现多知识库隔离 (V2 版本)
- [ ] 暂不实现 API 开放接口 (V2 版本)

---

## 7. 部署方案

### 7.1 环境规划

| 环境 | 用途 | 配置 |
|------|------|------|
| **开发环境** | 本地开发调试 | Docker Compose (单机) |
| **测试环境** | 集成测试、QA 验收 | Docker Compose (单机) |
| **生产环境** | 正式服务 | Kubernetes 集群 (高可用) |

---

### 7.2 生产环境架构

```
                    ┌─────────────┐
                    │   SLB/ALB   │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
┌────────▼────────┐ ┌──────▼──────┐ ┌───────▼───────┐
│  Web 服务 (×3)   │ │ API 服务 (×3) │ │  Celery Worker │
│  Nginx + React  │ │  FastAPI    │ │    (×2)       │
└─────────────────┘ └─────────────┘ └───────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
┌────────▼────────┐ ┌──────▼──────┐ ┌───────▼───────┐
│   PostgreSQL    │ │   Milvus    │ │     MinIO     │
│   (主从 + 副本)  │ │  (集群模式)  │ │   (多节点)     │
└─────────────────┘ └─────────────┘ └───────────────┘
```

---

### 7.3 资源配置 (生产环境)

| 服务 | CPU | 内存 | 存储 | 副本数 |
|------|-----|------|------|--------|
| Web 服务 | 2 核 | 4GB | - | 3 |
| API 服务 | 4 核 | 8GB | - | 3 |
| Celery Worker | 4 核 | 8GB | - | 2 |
| PostgreSQL | 8 核 | 32GB | 500GB SSD | 1 主 2 从 |
| Milvus | 8 核 | 32GB | 1TB SSD | 3 节点集群 |
| MinIO | 4 核 | 16GB | 2TB HDD | 4 节点 |
| Redis | 2 核 | 4GB | - | 1 主 1 从 |

---

### 7.4 Docker Compose (开发环境 - Node.js 版)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: rag
      POSTGRES_USER: rag
      POSTGRES_PASSWORD: rag123
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rag"]
      interval: 10s
      timeout: 5s
      retries: 5

  milvus:
    image: milvusdb/milvus:v2.4.0
    environment:
      ETCD_ENDPOINTS: etcd:2379
      MINIO_ADDRESS: minio:9000
    depends_on:
      - etcd
      - minio
    ports:
      - "19530:19530"
    volumes:
      - milvus:/var/lib/milvus

  etcd:
    image: quay.io/coreos/etcd:v3.5.0
    environment:
      - ETCD_AUTO_COMPACTION_MODE=revision
      - ETCD_AUTO_COMPACTION_RETENTION=1000
    volumes:
      - etcd:/etcd
    command: etcd -advertise-client-urls=http://127.0.0.1:2379 -listen-client-urls http://0.0.0.0:2379 --data-dir /etcd

  minio:
    image: minio/minio:RELEASE.2023-03-20T20-16-18Z
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: minio server /minio_data
    volumes:
      - minio:/minio_data
    ports:
      - "9000:9000"
      - "9001:9001"

  redis:
    image: redis:7
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Python 微服务 (Embedding + Rerank)
  embedding-service:
    build: ./services/embedding
    ports:
      - "8001:8001"
    environment:
      EMBEDDING_MODEL: bge-large-zh-v1.5
      RERANK_MODEL: bge-reranker-large
    volumes:
      - models:/app/models

  # Node.js 后端 API
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://rag:rag123@postgres:5432/rag
      MILVUS_HOST: milvus
      MILVUS_PORT: 19530
      REDIS_URL: redis://redis:6379
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
      EMBEDDING_SERVICE_URL: http://embedding-service:8001
      LLM_API_KEY: ${LLM_API_KEY}
      LLM_MODEL: qwen3.5-plus
      JWT_SECRET: ${JWT_SECRET:-dev-secret-change-in-prod}
    depends_on:
      postgres:
        condition: service_healthy
      milvus:
        condition: service_started
      redis:
        condition: service_healthy
      embedding-service:
        condition: service_started
    volumes:
      - ./backend:/app
      - /app/node_modules
    ports:
      - "3000:3000"
    command: pnpm run dev

  # 前端
  web:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    environment:
      NODE_ENV: development
      VITE_API_URL: http://localhost:3000
    depends_on:
      - api
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "5173:5173"
    command: pnpm run dev

volumes:
  pgdata:
  etcd:
  milvus:
  minio:
  models:
```

---

### 7.5 Docker 部署脚本

#### 7.5.1 快速启动脚本

```bash
#!/bin/bash
# scripts/dev-start.sh - 启动开发环境

set -e

echo "🚀 Starting RAG System Development Environment..."

# 检查 .env 文件
if [ ! -f .env ]; then
  echo "⚠️  .env file not found, creating from .env.example..."
  cp .env.example .env
fi

# 启动所有服务
docker-compose up -d

echo "⏳ Waiting for services to be ready..."

# 等待 PostgreSQL 就绪
until docker-compose exec -T postgres pg_isready -U rag > /dev/null 2>&1; do
  echo "  Waiting for PostgreSQL..."
  sleep 2
done

# 等待 Redis 就绪
until docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; do
  echo "  Waiting for Redis..."
  sleep 2
done

echo "✅ All services are up!"

# 运行数据库迁移
echo "📦 Running database migrations..."
docker-compose exec -T api pnpm prisma migrate deploy

# 初始化种子数据
echo "🌱 Seeding database..."
docker-compose exec -T api pnpm prisma db seed

echo ""
echo "🎉 Development environment is ready!"
echo ""
echo "📍 Frontend: http://localhost:5173"
echo "📍 Backend API: http://localhost:3000"
echo "📍 API Docs: http://localhost:3000/api/docs"
echo "📍 MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
echo ""
echo "📝 Useful commands:"
echo "  docker-compose logs -f api    # View API logs"
echo "  docker-compose logs -f web    # View frontend logs"
echo "  docker-compose stop           # Stop all services"
echo "  docker-compose down -v        # Stop and remove volumes"
```

#### 7.5.2 生产部署脚本

```bash
#!/bin/bash
# scripts/prod-deploy.sh - 生产环境部署

set -e

ENV_FILE=".env.production"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Production env file not found: $ENV_FILE"
  exit 1
fi

echo "🚀 Deploying RAG System to Production..."

# 加载环境变量
export $(cat $ENV_FILE | grep -v '^#' | xargs)

# 构建镜像
echo "🔨 Building Docker images..."
docker-compose -f docker-compose.prod.yml build

# 运行迁移
echo "📦 Running database migrations..."
docker-compose -f docker-compose.prod.yml run --rm api pnpm prisma migrate deploy

# 启动服务
echo "🚀 Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# 健康检查
echo "⏳ Waiting for services to be healthy..."
sleep 30

# 检查 API 健康
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
  echo "✅ Deployment successful!"
else
  echo "❌ API health check failed!"
  docker-compose -f docker-compose.prod.yml logs api
  exit 1
fi
```

#### 7.5.3 本地一键部署

```bash
#!/bin/bash
# scripts/local-deploy.sh - 本地 Docker 一键部署

set -e

echo "🚀 Local Docker Deployment for RAG System"
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed. Please install Docker Desktop first."
  exit 1
fi

if ! command -v docker-compose &> /dev/null; then
  echo "❌ Docker Compose is not installed."
  exit 1
fi

# 创建 .env 文件
if [ ! -f .env ]; then
  echo "📝 Creating .env file..."
  cat > .env << EOF
# LLM Configuration
LLM_API_KEY=your-api-key-here
LLM_MODEL=qwen3.5-plus

# JWT Secret (change in production!)
JWT_SECRET=your-secret-key-change-in-production

# MinIO Configuration
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Embedding Service
EMBEDDING_SERVICE_URL=http://embedding-service:8001
EOF
  echo "⚠️  Please edit .env file with your actual API keys!"
fi

# 启动服务
./scripts/dev-start.sh
```

---

## 8. 监控与告警

### 8.1 核心指标

| 指标 | 采集方式 | 告警阈值 |
|------|----------|----------|
| API 响应时间 (P95) | Prometheus | >3s |
| API 错误率 | Prometheus | >5% |
| 向量检索延迟 (P95) | 自定义指标 | >500ms |
| LLM 调用延迟 | 自定义指标 | >5s |
| 文档索引失败率 | 自定义指标 | >10% |
| 用户负反馈率 | 自定义指标 | >20% |
| Milvus CPU/内存 | Prometheus | >80% |
| PostgreSQL 连接数 | Prometheus | >90% |

---

### 8.2 日志规范

```python
# 结构化日志 (JSON 格式)
{
  "timestamp": "2026-03-23T12:00:00Z",
  "level": "INFO",
  "service": "rag-api",
  "trace_id": "uuid-xxx",
  "user_id": "uuid-yyy",
  "action": "chat",
  "question": "公司年假有多少天？",
  "latency_ms": 1250,
  "tokens_used": 450,
  "retrieved_docs": ["doc-001", "doc-002"],
  "confidence": 0.85
}
```

---

## 9. 安全设计

### 9.1 认证与授权

- **认证**: JWT Token (有效期 24h，刷新 Token 7d)
- **授权**: RBAC 角色模型 (admin/editor/viewer)
- **API 安全**: HTTPS、CORS、限流 (100 req/min/user)

---

### 9.2 数据安全

- **传输加密**: TLS 1.3
- **存储加密**: PostgreSQL TDE、MinIO SSE
- **敏感信息**: 密码 bcrypt 加密、密钥 1Password 管理
- **审计日志**: 所有操作记录日志，保留 180 天

---

### 9.3 权限模型

```
角色          文档上传  文档删除  知识库管理  用户管理  查看文档
viewer        ❌        ❌        ❌         ❌        ✅ (公开)
editor        ✅        ✅ (自己)  ❌         ❌        ✅ (公开 + 内部)
admin         ✅        ✅        ✅         ✅        ✅ (全部)
```

---

## 10. 后端项目结构

### 10.1 目录结构

```
backend/
├── prisma/
│   ├── schema.prisma          # 数据库 schema
│   ├── migrations/            # 迁移脚本
│   └── seed.ts                # 种子数据
├── src/
│   ├── main.ts                # 应用入口
│   ├── app.module.ts          # 根模块
│   ├── common/                # 公共模块
│   │   ├── decorators/        # 自定义装饰器
│   │   ├── filters/           # 异常过滤器
│   │   ├── guards/            # Auth Guard
│   │   ├── interceptors/      # 拦截器
│   │   └── pipes/             # 管道
│   ├── modules/
│   │   ├── auth/              # 认证模块
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.module.ts
│   │   │   ├── dto/
│   │   │   └── strategies/    # JWT Strategy
│   │   ├── user/              # 用户模块
│   │   ├── document/          # 文档模块
│   │   │   ├── document.controller.ts
│   │   │   ├── document.service.ts
│   │   │   ├── document.module.ts
│   │   │   ├── dto/
│   │   │   └── jobs/          # Bull 队列任务
│   │   ├── chat/              # 问答模块
│   │   │   ├── chat.controller.ts
│   │   │   ├── chat.service.ts
│   │   │   ├── chat.module.ts
│   │   │   └── dto/
│   │   ├── retrieval/         # 检索引擎模块
│   │   │   ├── retrieval.service.ts
│   │   │   ├── milvus.service.ts
│   │   │   └── embedding.service.ts
│   │   ├── llm/               # LLM 模块
│   │   │   ├── llm.service.ts
│   │   │   └── prompt.manager.ts
│   │   └── feedback/          # 反馈模块
│   ├── config/                # 配置模块
│   │   ├── config.module.ts
│   │   └── config.service.ts
│   └── types/                 # TypeScript 类型定义
├── tests/
│   ├── e2e/                   # 端到端测试
│   └── unit/                  # 单元测试
├── scripts/
│   ├── dev-start.sh           # 开发启动脚本
│   └── prod-deploy.sh         # 生产部署脚本
├── .env.example
├── .gitignore
├── Dockerfile
├── Dockerfile.dev
├── docker-compose.yml
├── nest-cli.json
├── package.json
├── tsconfig.json
└── README.md
```

---

### 10.2 Dockerfile

#### 10.2.1 开发环境 Dockerfile

```dockerfile
# backend/Dockerfile.dev
FROM node:20-alpine

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制 package 文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 生成 Prisma Client
RUN pnpm prisma generate

# 暴露端口
EXPOSE 3000

# 启动开发模式
CMD ["pnpm", "run", "dev"]
```

#### 10.2.2 生产环境 Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制 package 文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 生成 Prisma Client
RUN pnpm prisma generate

# 构建应用
RUN pnpm run build

# 生产阶段
FROM node:20-alpine AS runner

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制 package 文件并安装生产依赖
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# 暴露端口
EXPOSE 3000

# 运行迁移并启动
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/main"]
```

---

### 10.3 核心代码示例

#### 10.3.1 问答接口 (SSE 流式)

```typescript
// src/modules/chat/chat.controller.ts
import { Controller, Post, Body, UseGuards, Sse } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChatDto } from './dto/chat.dto';
import { Observable } from 'rxjs';

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('stream')
  @Sse('api/v1/chat/stream')
  chatStream(
    @Body() dto: ChatDto,
    @CurrentUser() user: { id: string; role: string },
  ): Observable<MessageEvent> {
    return this.chatService.chatStream(dto, user);
  }
}
```

#### 10.3.2 文档上传与异步处理

```typescript
// src/modules/document/document.service.ts
import { Injectable } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BullQueueService } from '../../common/queue/bull-queue.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DocumentService {
  constructor(
    private prisma: PrismaService,
    private queue: BullQueueService,
  ) {}

  async upload(file: Express.Multer.File, userId: string, kbId: string) {
    // 1. 保存文件到 MinIO
    const filePath = await this.saveToMinIO(file);
    
    // 2. 创建数据库记录
    const doc = await this.prisma.document.create({
      data: {
        filename: file.originalname,
        filePath,
        fileSize: file.size,
        fileType: this.getFileType(file.mimetype),
        knowledgeBaseId: kbId,
        createdBy: userId,
        status: 'pending',
      },
    });

    // 3. 加入异步处理队列
    await this.queue.add('process-document', {
      documentId: doc.id,
      filePath,
    });

    return { documentId: doc.id, status: 'processing' };
  }
}
```

#### 10.3.3 数据库迁移脚本

```bash
# 开发环境：生成迁移
cd backend
pnpm prisma migrate dev --name init

# 生产环境：应用迁移
pnpm prisma migrate deploy

# 查看迁移历史
pnpm prisma migrate status

# 重置数据库 (仅开发)
pnpm prisma migrate reset
```

---

**文档结束**

---

## 附录：快速参考

### 命令速查

```bash
# 启动开发环境
docker-compose up -d

# 查看 API 日志
docker-compose logs -f api

# 进入 Milvus 容器
docker-compose exec milvus bash

# 数据库迁移
alembic upgrade head

# 运行测试
pytest tests/ -v
```

### 关键配置

```bash
# .env 配置示例
DATABASE_URL=postgresql://rag:rag123@localhost:5432/rag
MILVUS_HOST=localhost
MILVUS_PORT=19530
REDIS_URL=redis://localhost:6379
LLM_API_KEY=sk-xxx
LLM_MODEL=qwen3.5-plus
EMBEDDING_MODEL=bge-large-zh-v1.5
CHUNK_SIZE=500
CHUNK_OVERLAP=100
TOP_K=5
SIMILARITY_THRESHOLD=0.3
```
