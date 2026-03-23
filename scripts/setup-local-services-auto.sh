#!/bin/bash
# 自动化版本，默认复用现有 PostgreSQL

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║     RAG System 本地服务一键配置脚本                     ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 检查 Docker
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker 未运行，正在启动 Docker Desktop..."
    open -a Docker
    sleep 30
fi

echo "✅ Docker 运行正常"
echo ""

# 创建 Docker 网络
echo "📡 创建 Docker 网络..."
docker network create rag-network 2>/dev/null || echo "  网络已存在"
echo ""

# 启动现有 PostgreSQL
echo "🔄 启动现有 PostgreSQL 容器 (edu-llm-postgres-1)..."
docker start edu-llm-postgres-1 2>/dev/null || true
sleep 3
echo "✅ PostgreSQL 已启动"
echo ""

# 启动 Redis
echo "🔴 创建 Redis 容器..."
docker run -d \
  --name rag-redis \
  --network rag-network \
  -p 6379:6379 \
  -v rag-redis-data:/data \
  --restart unless-stopped \
  redis:7-alpine
echo "✅ Redis 已启动 (端口：6379)"
echo ""

# 启动 MinIO
echo "📦 创建 MinIO 容器..."
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
echo "✅ MinIO 已启动 (端口：9000, 控制台：9001)"
echo ""

# 启动 etcd
echo "📌 创建 etcd 容器..."
docker run -d \
  --name rag-etcd \
  --network rag-network \
  -p 2379:2379 \
  -v rag-etcd-data:/etcd \
  --restart unless-stopped \
  quay.io/coreos/etcd:v3.5.0 \
  etcd -advertise-client-urls=http://127.0.0.1:2379 \
       -listen-client-urls http://0.0.0.0:2379 \
       --data-dir /etcd
sleep 5
echo "✅ etcd 已启动 (端口：2379)"
echo ""

# 启动 Milvus
echo "🔍 创建 Milvus 容器..."
docker run -d \
  --name rag-milvus \
  --network rag-network \
  -p 19530:19530 \
  -p 9091:9091 \
  -e ETCD_ENDPOINTS=rag-etcd:2379 \
  -e MINIO_ADDRESS=rag-minio:9000 \
  -v rag-milvus-data:/var/lib/milvus \
  --restart unless-stopped \
  milvusdb/milvus:v2.4.0
echo "✅ Milvus 已启动 (端口：19530)"
echo ""

echo "⏳ 等待所有服务就绪..."
sleep 15

# 健康检查
echo ""
echo "🏥 健康检查..."
echo ""

# PostgreSQL
if docker exec edu-llm-postgres-1 pg_isready -U edu > /dev/null 2>&1; then
    echo "✅ PostgreSQL: 正常 (数据库：edu_llm)"
else
    echo "⚠️  PostgreSQL: 等待中..."
fi

# Redis
if docker exec rag-redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis: 正常"
else
    echo "⚠️  Redis: 等待中..."
fi

# MinIO
if curl -s http://localhost:9000/minio/health/live > /dev/null 2>&1; then
    echo "✅ MinIO: 正常"
else
    echo "⚠️  MinIO: 等待中..."
fi

# Milvus
if curl -s http://localhost:19530/api/v1/version > /dev/null 2>&1; then
    echo "✅ Milvus: 正常"
else
    echo "⚠️  Milvus: 等待中..."
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║           ✅ 所有服务配置完成！                         ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "📍 服务地址:"
echo "   ┌─────────────┬───────────────┬──────────────────────────────────┐"
echo "   │ 服务        │ 端口          │ 连接信息                         │"
echo "   ├─────────────┼───────────────┼──────────────────────────────────┤"
echo "   │ PostgreSQL  │ localhost:5432│ postgres://edu:edu@localhost:5432/edu_llm"
echo "   │ Redis       │ localhost:6379│ redis://localhost:6379           "
echo "   │ MinIO       │ localhost:9000│ minioadmin / minioadmin          "
echo "   │ MinIO Console│ localhost:9001│ http://localhost:9001           "
echo "   │ Milvus      │ localhost:19530│ 向量数据库                      "
echo "   │ etcd        │ localhost:2379│ Milvus 依赖                      "
echo "   └─────────────┴───────────────┴──────────────────────────────────┘"
echo ""
echo "📝 下一步:"
echo ""
echo "   1️⃣  复制并配置环境变量:"
echo "      cp .env.example .env"
echo ""
echo "   2️⃣  编辑 .env 文件，设置以下配置:"
echo "      DATABASE_URL=postgresql://edu:edu@localhost:5432/edu_llm"
echo "      MILVUS_HOST=localhost"
echo "      MILVUS_PORT=19530"
echo "      REDIS_URL=redis://localhost:6379"
echo "      MINIO_ENDPOINT=localhost:9000"
echo "      MINIO_ACCESS_KEY=minioadmin"
echo "      MINIO_SECRET_KEY=minioadmin"
echo "      LLM_API_KEY=sk-your-api-key-here"
echo ""
echo "   3️⃣  启动 Embedding 服务:"
echo "      cd services/embedding"
echo "      pnpm install"
echo "      pnpm run dev"
echo ""
echo "   4️⃣  启动前后端应用:"
echo "      cd ../.."
echo "      docker-compose up -d"
echo ""
echo "   5️⃣  运行数据库迁移:"
echo "      docker-compose exec api pnpm prisma migrate dev"
echo "      docker-compose exec api pnpm prisma db seed"
echo ""
echo "🛑 停止服务:"
echo "   docker stop edu-llm-postgres-1 rag-redis rag-minio rag-milvus rag-etcd"
echo ""
echo "📊 查看服务状态:"
echo "   docker ps --filter name=rag-"
echo ""
