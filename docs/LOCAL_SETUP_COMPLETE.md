# 本地服务配置完成报告

**日期**: 2026-03-23  
**状态**: ✅ 部分完成

---

## ✅ 已完成的服务

### 1. PostgreSQL
- **状态**: ✅ 已启动
- **容器名**: `edu-llm-postgres-1`
- **端口**: `localhost:5432`
- **数据库**: `edu_llm`
- **用户**: `edu`
- **密码**: `edu`
- **连接字符串**: `postgresql://edu:edu@localhost:5432/edu_llm`

---

## ⏳ 待启动的服务

### 2. Redis
```bash
docker run -d \
  --name rag-redis \
  --network rag-network \
  -p 6379:6379 \
  -v rag-redis-data:/data \
  --restart unless-stopped \
  redis:7-alpine
```

### 3. MinIO
```bash
docker run -d \
  --name rag-minio \
  --network rag-network \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  -v rag-minio-data:/minio_data \
  --restart unless-stopped \
  minio/minio:RELEASE.2023-03-20T20-16-18Z \
  server /minio_data --console-address ":9001"
```

### 4. Qdrant (向量数据库)
```bash
docker run -d \
  --name rag-qdrant \
  --network rag-network \
  -p 6333:6333 \
  -p 6334:6334 \
  -v rag-qdrant-data:/qdrant/storage \
  --restart unless-stopped \
  qdrant/qdrant:v1.13.4
```

---

## 🚀 一键启动所有服务

执行以下命令：

```bash
cd /Users/daniel/Desktop/openclaw-projects/rag-system

# 1. 创建 Docker 网络
docker network create rag-network

# 2. 启动 Redis
docker pull redis:7-alpine
docker run -d --name rag-redis --network rag-network -p 6379:6379 -v rag-redis-data:/data --restart unless-stopped redis:7-alpine

# 3. 启动 MinIO
docker pull minio/minio:RELEASE.2023-03-20T20-16-18Z
docker run -d --name rag-minio --network rag-network -p 9000:9000 -p 9001:9001 -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin -v rag-minio-data:/minio_data --restart unless-stopped minio/minio:RELEASE.2023-03-20T20-16-18Z server /minio_data --console-address ":9001"

# 4. 启动 etcd
docker pull quay.io/coreos/etcd:v3.5.0
docker run -d --name rag-etcd --network rag-network -p 2379:2379 -v rag-etcd-data:/etcd --restart unless-stopped quay.io/coreos/etcd:v3.5.0 etcd -advertise-client-urls=http://127.0.0.1:2379 -listen-client-urls http://0.0.0.0:2379 --data-dir /etcd

# 5. 等待 5 秒
sleep 5

# 6. 启动 Milvus
docker pull milvusdb/milvus:v2.4.0
docker run -d --name rag-milvus --network rag-network -p 19530:19530 -e ETCD_ENDPOINTS=rag-etcd:2379 -e MINIO_ADDRESS=rag-minio:9000 -v rag-milvus-data:/var/lib/milvus --restart unless-stopped milvusdb/milvus:v2.4.0

# 7. 等待服务就绪
sleep 15

# 8. 健康检查
docker ps --filter name=rag-
```

---

## 📍 服务地址汇总

| 服务 | 地址 | 端口 | 账号/密码 |
|------|------|------|-----------|
| PostgreSQL | localhost | 5432 | edu/edu |
| Redis | localhost | 6379 | - |
| MinIO | localhost | 9000 | minioadmin/minioadmin |
| MinIO Console | localhost | 9001 | minioadmin/minioadmin |
| Qdrant | localhost | 6333 | - |
| Qdrant gRPC | localhost | 6334 | - |

---

## 📝 环境变量配置

已配置 `.env` 文件，内容如下：

```bash
# 数据库
DATABASE_URL=postgresql://edu:edu@localhost:5432/edu_llm

# Qdrant 向量数据库
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_GRPC_PORT=6334

# Redis
REDIS_URL=redis://localhost:6379

# MinIO
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Embedding 服务
EMBEDDING_SERVICE_URL=http://localhost:8001

# LLM
LLM_API_KEY=sk-your-api-key-here
```

---

## 🔧 后续步骤

### 1. 启动所有外部服务
执行上面的"一键启动所有服务"命令

### 2. 启动 Embedding 服务
```bash
cd services/embedding
pnpm install
pnpm run dev
```

### 3. 启动前后端应用
```bash
cd ../..
docker-compose up -d
```

### 4. 运行数据库迁移
```bash
docker-compose exec api pnpm prisma migrate dev
docker-compose exec api pnpm prisma db seed
```

### 5. 访问应用
- 前端：http://localhost:5173
- 后端 API: http://localhost:3000
- API 文档：http://localhost:3000/api/docs

---

## 🛑 停止服务命令

```bash
# 停止所有 RAG 服务
docker stop rag-redis rag-minio rag-milvus rag-etcd

# 停止 PostgreSQL(现有的，谨慎操作)
docker stop edu-llm-postgres-1

# 删除容器（可选）
docker rm rag-redis rag-minio rag-milvus rag-etcd
```

---

## 📊 当前状态

| 服务 | 状态 | 备注 |
|------|------|------|
| PostgreSQL | ✅ 运行中 | 复用现有容器 |
| Redis | ⏳ 待启动 | 需要下载镜像 |
| MinIO | ⏳ 待启动 | 需要下载镜像 |
| Qdrant | ⏳ 待启动 | 向量数据库（轻量） |
| Embedding 服务 | ⏳ 待启动 | TypeScript 服务 |
| 后端 API | ⏳ 待启动 | NestJS |
| 前端 | ⏳ 待启动 | React |

---

**执行者**: 软件开发小组  
**完成时间**: 2026-03-23  
**下一步**: 执行一键启动命令完成剩余服务配置
