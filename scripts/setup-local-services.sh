#!/bin/bash
# scripts/setup-local-services.sh - 本地服务一键配置脚本

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║     RAG System 本地服务一键配置脚本                     ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 检查 Docker 是否运行
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker 未运行，正在启动 Docker Desktop..."
    open -a Docker
    echo "⏳ 等待 Docker 启动 (约 30 秒)..."
    sleep 30
fi

echo "✅ Docker 运行正常"
echo ""

# 检查现有服务
echo "📊 检查现有服务..."
echo ""

HAS_POSTGRES=false
HAS_REDIS=false
HAS_MILVUS=false
HAS_MINIO=false

# 检查 PostgreSQL
if docker ps -a --format "{{.Names}}" | grep -q "rag-postgres"; then
    echo "✅ 发现 PostgreSQL 容器 (rag-postgres)"
    HAS_POSTGRES=true
elif docker ps -a --format "{{.Names}}" | grep -q "edu-llm-postgres"; then
    echo "✅ 发现现有 PostgreSQL 容器 (edu-llm-postgres-1)，可以复用"
    HAS_POSTGRES=true
else
    echo "⚠️  未找到 PostgreSQL 容器"
fi

# 检查 Redis
if docker ps -a --format "{{.Names}}" | grep -q "rag-redis"; then
    echo "✅ 发现 Redis 容器 (rag-redis)"
    HAS_REDIS=true
else
    echo "⚠️  未找到 Redis 容器"
fi

# 检查 Milvus
if docker ps -a --format "{{.Names}}" | grep -q "rag-milvus"; then
    echo "✅ 发现 Milvus 容器 (rag-milvus)"
    HAS_MILVUS=true
else
    echo "⚠️  未找到 Milvus 容器"
fi

# 检查 MinIO
if docker ps -a --format "{{.Names}}" | grep -q "rag-minio"; then
    echo "✅ 发现 MinIO 容器 (rag-minio)"
    HAS_MINIO=true
else
    echo "⚠️  未找到 MinIO 容器"
fi

echo ""

# 询问是否使用现有 PostgreSQL
if [ "$HAS_POSTGRES" = true ]; then
    echo "🤔 是否复用现有的 PostgreSQL 容器？(y/n)"
    read -r response
    if [[ "$response" =~ ^[yY](es)?$ ]]; then
        USE_EXISTING_POSTGRES=true
        echo "✅ 将复用现有 PostgreSQL 容器"
    else
        USE_EXISTING_POSTGRES=false
        echo "✅ 将创建新的 PostgreSQL 容器"
    fi
else
    USE_EXISTING_POSTGRES=false
fi

echo ""
echo "🚀 开始配置服务..."
echo ""

# 创建 Docker 网络
echo "📡 创建 Docker 网络..."
docker network create rag-network 2>/dev/null || echo "  网络已存在"
echo "✅ 网络创建完成"
echo ""

# 启动 PostgreSQL
if [ "$USE_EXISTING_POSTGRES" = true ]; then
    echo "🔄 启动现有 PostgreSQL 容器..."
    docker start edu-llm-postgres-1 2>/dev/null || docker start rag-postgres 2>/dev/null || true
    echo "✅ PostgreSQL 已启动"
elif [ "$HAS_POSTGRES" = false ]; then
    echo "🐘 创建 PostgreSQL 容器..."
    docker run -d \
      --name rag-postgres \
      --network rag-network \
      -p 5432:5432 \
      -e POSTGRES_DB=rag \
      -e POSTGRES_USER=rag \
      -e POSTGRES_PASSWORD=rag123 \
      -v rag-pgdata:/var/lib/postgresql/data \
      --restart unless-stopped \
      postgres:15-alpine
    echo "✅ PostgreSQL 已启动 (端口：5432)"
fi

# 启动 Redis
if [ "$HAS_REDIS" = false ]; then
    echo "🔴 创建 Redis 容器..."
    docker run -d \
      --name rag-redis \
      --network rag-network \
      -p 6379:6379 \
      -v rag-redis-data:/data \
      --restart unless-stopped \
      redis:7-alpine
    echo "✅ Redis 已启动 (端口：6379)"
else
    echo "🔄 启动现有 Redis 容器..."
    docker start rag-redis 2>/dev/null || true
    echo "✅ Redis 已启动"
fi

# 启动 MinIO
if [ "$HAS_MINIO" = false ]; then
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
else
    echo "🔄 启动现有 MinIO 容器..."
    docker start rag-minio 2>/dev/null || true
    echo "✅ MinIO 已启动"
fi

# 启动 Milvus (需要 etcd 和 MinIO)
if [ "$HAS_MILVUS" = false ]; then
    echo "🔍 创建 Milvus 容器（包含 etcd）..."
    
    # 先启动 etcd
    echo "  📌 启动 etcd..."
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
    
    # 启动 Milvus
    docker run -d \
      --name rag-milvus \
      --network rag-network \
      -p 19530:19530 \
      -p 9091:9091 \
      -e ETCD_ENDPOINTS=rag-etcd:2379 \
      -e MINIO_ADDRESS=rag-minio:9000 \
      -v rag-milvus-data:/var/lib/milvus \
      --restart unless-stopped \
      --depends-on rag-etcd \
      milvusdb/milvus:v2.4.0
    
    echo "✅ Milvus 已启动 (端口：19530)"
    echo "✅ etcd 已启动 (端口：2379)"
else
    echo "🔄 启动现有 Milvus 容器..."
    docker start rag-milvus 2>/dev/null || true
    echo "✅ Milvus 已启动"
fi

echo ""
echo "⏳ 等待所有服务就绪..."
sleep 10

# 健康检查
echo ""
echo "🏥 健康检查..."
echo ""

# 检查 PostgreSQL
if docker exec rag-postgres pg_isready -U rag > /dev/null 2>&1 || \
   docker exec edu-llm-postgres-1 pg_isready -U edu > /dev/null 2>&1; then
    echo "✅ PostgreSQL: 正常"
else
    echo "⚠️  PostgreSQL: 等待中..."
fi

# 检查 Redis
if docker exec rag-redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis: 正常"
else
    echo "⚠️  Redis: 等待中..."
fi

# 检查 MinIO
if curl -s http://localhost:9000/minio/health/live > /dev/null 2>&1; then
    echo "✅ MinIO: 正常"
else
    echo "⚠️  MinIO: 等待中..."
fi

# 检查 Milvus
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
echo "   PostgreSQL: localhost:5432"
echo "   Redis:      localhost:6379"
echo "   MinIO:      localhost:9000 (控制台：localhost:9001)"
echo "   Milvus:     localhost:19530"
echo ""
echo "🔑 连接信息:"
if [ "$USE_EXISTING_POSTGRES" = true ]; then
    echo "   PostgreSQL: postgres://edu:edu@localhost:5432/edu_llm"
else
    echo "   PostgreSQL: postgres://rag:rag123@localhost:5432/rag"
fi
echo "   Redis:      redis://localhost:6379"
echo "   MinIO:      minioadmin / minioadmin"
echo ""
echo "📝 下一步:"
echo "   1. 复制环境变量文件:"
echo "      cp .env.example .env"
echo ""
echo "   2. 编辑 .env 文件，配置数据库连接信息"
echo ""
echo "   3. 启动 Embedding 服务和前后端应用"
echo ""
echo "🛑 停止所有服务:"
echo "   docker stop rag-postgres rag-redis rag-minio rag-milvus rag-etcd"
echo ""
echo "   或者使用 Docker Compose:"
echo "   docker-compose -f docker-compose.infra.yml down"
echo ""
