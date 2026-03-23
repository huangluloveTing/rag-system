#!/bin/bash
# scripts/dev-start.sh - 启动开发环境

set -e

echo "🚀 Starting RAG System Development Environment..."
echo ""

# 检查 .env 文件
if [ ! -f .env ]; then
  echo "⚠️  .env file not found, creating from .env.example..."
  cp .env.example .env
  echo "✅ .env file created. Please edit it with your actual API keys!"
  echo ""
fi

# 进入项目目录
cd "$(dirname "$0")/.."

# 启动 Docker 服务
echo "🐳 Starting Docker services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."

# 等待 PostgreSQL 就绪
echo "  Waiting for PostgreSQL..."
until docker-compose exec -T postgres pg_isready -U rag > /dev/null 2>&1; do
  sleep 2
done
echo "  ✅ PostgreSQL is ready"

# 等待 Redis 就绪
echo "  Waiting for Redis..."
until docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; do
  sleep 2
done
echo "  ✅ Redis is ready"

# 等待 Milvus 就绪
echo "  Waiting for Milvus..."
sleep 10
echo "  ✅ Milvus should be ready"

echo ""
echo "✅ All Docker services are up!"
echo ""

# 提示下一步操作
echo "📍 Next steps:"
echo ""
echo "1. Install backend dependencies:"
echo "   cd backend && pnpm install"
echo ""
echo "2. Run database migrations:"
echo "   cd backend && pnpm prisma migrate deploy"
echo ""
echo "3. Seed database (optional):"
echo "   cd backend && pnpm prisma db seed"
echo ""
echo "4. Start backend dev server:"
echo "   cd backend && pnpm run dev"
echo ""
echo "5. In another terminal, start frontend:"
echo "   cd frontend && pnpm install && pnpm run dev"
echo ""
echo "📍 Service URLs:"
echo "   Frontend: http://localhost:5173"
echo "   Backend API: http://localhost:3000"
echo "   API Docs: http://localhost:3000/api/docs"
echo "   MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
echo ""
echo "📝 Useful commands:"
echo "   docker-compose logs -f api          # View API logs"
echo "   docker-compose logs -f web          # View frontend logs"
echo "   docker-compose stop                 # Stop all services"
echo "   docker-compose down -v              # Stop and remove volumes"
echo ""
