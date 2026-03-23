#!/bin/bash
# 快速启动所有服务

set -e

echo "🚀 开始启动 RAG System 所有服务..."
echo ""

# 1. 创建网络
echo "📡 创建 Docker 网络..."
docker network create rag-network 2>/dev/null || echo "  网络已存在"

# 2. 启动 Redis
echo ""
echo "🔴 启动 Redis..."
if ! docker ps --format "{{.Names}}" | grep -q "rag-redis"; then
    docker pull redis:7-alpine
    docker run -d --name rag-redis --network rag-network -p 6379:6379 -v rag-redis-data:/data --restart unless-stopped redis:7-alpine
    echo "✅ Redis 已启动"
else
    echo "✅ Redis 已在运行"
fi

# 3. 启动 MinIO
echo ""
echo "📦 启动 MinIO..."
if ! docker ps --format "{{.Names}}" | grep -q "rag-minio"; then
    docker pull minio/minio:RELEASE.2023-03-20T20-16-18Z
    docker run -d --name rag-minio --network rag-network -p 9000:9000 -p 9001:9001 -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin -v rag-minio-data:/minio_data --restart unless-stopped minio/minio:RELEASE.2023-03-20T20-16-18Z server /minio_data --console-address ":9001"
    echo "✅ MinIO 已启动"
else
    echo "✅ MinIO 已在运行"
fi

# 4. 启动 Qdrant
echo ""
echo "🔍 启动 Qdrant (向量数据库)..."
if ! docker ps --format "{{.Names}}" | grep -q "rag-qdrant"; then
    docker pull qdrant/qdrant:v1.13.4
    docker run -d --name rag-qdrant --network rag-network -p 6333:6333 -p 6334:6334 -v rag-qdrant-data:/qdrant/storage --restart unless-stopped qdrant/qdrant:v1.13.4
    echo "✅ Qdrant 已启动"
else
    echo "✅ Qdrant 已在运行"
fi

echo ""
echo "⏳ 等待所有服务就绪..."
sleep 15

# 健康检查
echo ""
echo "🏥 健康检查..."
echo ""

# PostgreSQL
if docker exec edu-llm-postgres-1 pg_isready -U edu > /dev/null 2>&1; then
    echo "✅ PostgreSQL: 正常"
else
    echo "⚠️  PostgreSQL: 未就绪"
fi

# Redis
if docker exec rag-redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis: 正常"
else
    echo "⚠️  Redis: 未就绪"
fi

# MinIO
if curl -s http://localhost:9000/minio/health/live > /dev/null 2>&1; then
    echo "✅ MinIO: 正常"
else
    echo "⚠️  MinIO: 未就绪"
fi

# Qdrant
if curl -s http://localhost:6333/ > /dev/null 2>&1; then
    echo "✅ Qdrant: 正常"
else
    echo "⚠️  Qdrant: 未就绪"
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║           ✅ 所有服务启动完成！                         ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "📍 服务地址:"
echo "   PostgreSQL:  localhost:5432 (edu/edu)"
echo "   Redis:       localhost:6379"
echo "   MinIO:       localhost:9000 (minioadmin/minioadmin)"
echo "   MinIO Console: localhost:9001"
echo "   Qdrant:      localhost:6333 (HTTP)"
echo "   Qdrant gRPC: localhost:6334"
echo ""
echo "📝 下一步:"
echo "   1. cd services/embedding && pnpm install && pnpm run dev"
echo "   2. docker-compose up -d"
echo "   3. docker-compose exec api pnpm prisma migrate dev"
echo ""
