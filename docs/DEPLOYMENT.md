# RAG 系统部署指南

**版本**: v1.0  
**最后更新**: 2026-03-23

---

## 📋 目录

1. [架构说明](#架构说明)
2. [环境准备](#环境准备)
3. [本地开发部署](#本地开发部署)
4. [Docker 部署](#docker-部署)
5. [生产环境部署](#生产环境部署)
6. [常见问题](#常见问题)

---

## 架构说明

### 部署架构

```
┌─────────────────────────────────────────────────────┐
│              Docker Compose 部署                      │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐                  │
│  │   Frontend  │  │   Backend   │                  │
│  │   (React)   │  │  (NestJS)   │                  │
│  │  Port:5173  │  │  Port:3000  │                  │
│  └─────────────┘  └─────────────┘                  │
└─────────────────────────────────────────────────────┘
         │                    │
         │                    │
         ▼                    ▼
┌─────────────────────────────────────────────────────┐
│              外部服务（通过环境变量配置）               │
├─────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │PostgreSQL│ │  Milvus  │ │  Redis   │ │ MinIO  │ │
│  │  :5432   │ │  :19530  │ │  :6379   │ │ :9000  │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │        Embedding Service (TypeScript)          │ │
│  │                  Port: 8001                    │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 优势

- ✅ **Docker 轻量化**: 只部署前后端应用，镜像小、启动快
- ✅ **外部服务复用**: 可连接公司已有的数据库/缓存服务
- ✅ **灵活扩展**: 各服务可独立扩展
- ✅ **开发友好**: 本地调试方便，支持热重载

---

## 环境准备

### 前置要求

| 软件 | 版本 | 用途 |
|------|------|------|
| Docker | 20+ | 前后端容器化 |
| Node.js | 20+ | 本地开发（可选） |
| pnpm | 8+ | 包管理 |
| PostgreSQL | 15+ | 关系数据库 |
| Milvus | 2.4+ | 向量数据库 |
| Redis | 7+ | 缓存/队列 |
| MinIO | 最新 | 对象存储 |

### 快速安装外部服务

#### 方式 1: Docker Compose（推荐）

创建 `docker-compose.infra.yml`：

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
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

  qdrant:
    image: qdrant/qdrant:v1.13.4
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant:/qdrant/storage
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:RELEASE.2023-03-20T20-16-18Z
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: minio server /minio_data --console-address ":9001"
    volumes:
      - minio:/minio_data
    ports:
      - "9000:9000"
      - "9001:9001"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  etcd:
  milvus:
  minio:
```

启动基础设施：

```bash
docker-compose -f docker-compose.infra.yml up -d
```

#### 方式 2: 使用已有服务

如果公司已有 PostgreSQL/Redis 等服务，直接配置环境变量即可。

---

## 本地开发部署

### 1. 克隆项目

```bash
cd /Users/daniel/Desktop/openclaw-projects/rag-system
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置外部服务地址：

```bash
# 数据库
DATABASE_URL=postgresql://rag:rag123@localhost:5432/rag

# Milvus
MILVUS_HOST=localhost
MILVUS_PORT=19530

# Redis
REDIS_URL=redis://localhost:6379

# MinIO
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# LLM API Key
LLM_API_KEY=sk-your-api-key-here
```

### 3. 启动基础设施

```bash
docker-compose -f docker-compose.infra.yml up -d
```

### 4. 启动 Embedding 服务

```bash
cd services/embedding
pnpm install
pnpm run dev
```

### 5. 启动后端

```bash
cd backend
pnpm install
pnpm prisma generate
pnpm prisma migrate dev --name init
pnpm prisma db seed
pnpm run dev
```

### 6. 启动前端

```bash
cd frontend
pnpm install
pnpm run dev
```

### 7. 访问应用

- 前端：http://localhost:5173
- 后端 API: http://localhost:3000
- API 文档：http://localhost:3000/api/docs
- MinIO 控制台：http://localhost:9001

---

## Docker 部署

### 1. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件
```

### 2. 启动前后端应用

```bash
docker-compose up -d
```

### 3. 运行数据库迁移

```bash
docker-compose exec api pnpm prisma migrate deploy
docker-compose exec api pnpm prisma db seed
```

### 4. 查看日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看后端日志
docker-compose logs -f api

# 查看前端日志
docker-compose logs -f web
```

### 5. 停止服务

```bash
docker-compose down
```

---

## 生产环境部署

### 1. 环境变量配置

创建 `.env.production`：

```bash
# 生产环境配置
NODE_ENV=production

# 数据库（使用高可用实例）
DATABASE_URL=postgresql://user:pass@prod-db-host:5432/rag

# Milvus 集群
MILVUS_HOST=prod-milvus-host
MILVUS_PORT=19530

# Redis 集群
REDIS_URL=redis://prod-redis-host:6379

# MinIO（生产密钥）
MINIO_ACCESS_KEY=prod-access-key
MINIO_SECRET_KEY=prod-secret-key

# LLM API Key
LLM_API_KEY=sk-prod-api-key

# JWT（强密钥）
JWT_SECRET=your-super-strong-secret-key-at-least-32-chars
```

### 2. 构建生产镜像

```bash
docker-compose -f docker-compose.prod.yml build
```

### 3. 部署到生产环境

```bash
# 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 运行迁移
docker-compose -f docker-compose.prod.yml run --rm api pnpm prisma migrate deploy

# 健康检查
curl http://localhost:3000/health
```

### 4. 配置反向代理（Nginx）

```nginx
server {
    listen 80;
    server_name rag.example.com;

    # 前端
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 后端 API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $http_host;
    }

    # Embedding 服务
    location /embedding {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 常见问题

### Q1: 无法连接数据库

**症状**: 后端启动时报 `ECONNREFUSED`

**解决**:
```bash
# 检查 PostgreSQL 是否运行
docker ps | grep postgres

# 测试连接
docker-compose -f docker-compose.infra.yml exec postgres pg_isready -U rag

# 检查环境变量
echo $DATABASE_URL
```

### Q2: Milvus 连接失败

**症状**: 向量检索时报错

**解决**:
```bash
# 检查 Milvus 状态
docker ps | grep milvus

# 查看 Milvus 日志
docker-compose -f docker-compose.infra.yml logs milvus

# 测试连接
curl http://localhost:19530/api/v1/version
```

### Q3: Embedding 服务启动慢

**症状**: 首次请求超时

**解决**:
```bash
# 预加载模型
export PRELOAD_MODELS=true
pnpm run dev

# 或等待首次请求时自动下载（约 1-2 分钟）
```

### Q4: 前端无法连接后端

**症状**: 浏览器 CORS 错误

**解决**:
```bash
# 检查 .env 配置
CORS_ORIGIN=http://localhost:5173

# 重启后端
docker-compose restart api
```

### Q5: 数据库迁移失败

**症状**: `prisma migrate` 报错

**解决**:
```bash
# 查看迁移状态
pnpm prisma migrate status

# 重置迁移（开发环境）
pnpm prisma migrate reset

# 重新应用迁移
pnpm prisma migrate dev
```

---

## 监控与运维

### 健康检查

```bash
# 后端健康
curl http://localhost:3000/health

# Embedding 健康
curl http://localhost:8001/health

# PostgreSQL 健康
docker-compose -f docker-compose.infra.yml exec postgres pg_isready -U rag

# Redis 健康
docker-compose -f docker-compose.infra.yml exec redis redis-cli ping
```

### 日志查看

```bash
# 实时日志
docker-compose logs -f

# 最近 100 行
docker-compose logs --tail=100

# 特定服务
docker-compose logs -f api
```

### 数据备份

```bash
# PostgreSQL 备份
docker-compose -f docker-compose.infra.yml exec postgres \
  pg_dump -U rag rag > backup_$(date +%Y%m%d).sql

# Milvus 备份（参考官方文档）
```

---

## 性能优化

### 1. Embedding 服务优化

```bash
# 使用 GPU 加速（如有）
docker run --gpus all -p 8001:8001 embedding-service

# 预加载模型
export PRELOAD_MODELS=true
```

### 2. 数据库优化

```sql
-- 添加索引
CREATE INDEX idx_documents_kb ON documents(knowledge_base_id);
CREATE INDEX idx_chunks_doc ON chunks(doc_id);
```

### 3. 缓存优化

```bash
# Redis 配置最大内存
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

---

## 相关文档

- [产品需求文档](./docs/001-rag-system-product-requirements.md)
- [技术方案设计](./docs/002-rag-system-technical-design.md)
- [项目 README](./README.md)

---

**维护者**: 软件开发小组  
**最后更新**: 2026-03-23
