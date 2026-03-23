#!/bin/bash
# 开发环境启动脚本

set -e

echo "🚀 Starting RAG System Backend Development Environment..."

# 检查 .env 文件
if [ ! -f .env ]; then
  echo "⚠️  .env file not found, creating from .env.example..."
  cp .env.example .env
  echo "⚠️  Please edit .env file with your actual configuration!"
fi

# 检查 Docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed. Please install Docker Desktop first."
  exit 1
fi

if ! command -v docker-compose &> /dev/null; then
  echo "❌ Docker Compose is not installed."
  exit 1
fi

# 启动所有服务
echo "📦 Starting Docker services..."
docker-compose up -d

echo "⏳ Waiting for services to be ready..."

# 等待 PostgreSQL 就绪
echo "  Waiting for PostgreSQL..."
until docker-compose exec -T postgres pg_isready -U rag > /dev/null 2>&1; do
  sleep 2
done

# 等待 Redis 就绪
echo "  Waiting for Redis..."
until docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; do
  sleep 2
done

# 等待 MinIO 就绪
echo "  Waiting for MinIO..."
until docker-compose exec -T minio curl -s http://localhost:9000/minio/health/live > /dev/null 2>&1; do
  sleep 2
done

echo "✅ All infrastructure services are up!"

# 安装依赖
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# 生成 Prisma Client
echo "🔧 Generating Prisma Client..."
pnpm prisma generate

# 运行数据库迁移
echo "📦 Running database migrations..."
docker-compose exec -T api pnpm prisma migrate dev --name init

# 插入种子数据
echo "🌱 Seeding database..."
docker-compose exec -T api pnpm prisma db seed

echo ""
echo "🎉 Development environment is ready!"
echo ""
echo "📍 Backend API: http://localhost:3000"
echo "📍 API Docs: http://localhost:3000/api/docs"
echo "📍 MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
echo ""
echo "📝 Useful commands:"
echo "  docker-compose logs -f api    # View API logs"
echo "  docker-compose stop           # Stop all services"
echo "  docker-compose down -v        # Stop and remove volumes"
echo "  pnpm run dev                  # Start development server"
echo ""
