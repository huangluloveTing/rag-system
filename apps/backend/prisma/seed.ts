/**
 * 数据库种子数据脚本
 * 创建初始管理员账号和默认知识库
 */
import { PrismaClient } from './generated/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
})

const prisma = new PrismaClient({
  adapter
});

async function main() {
  console.log('🌱 Starting database seeding...');

  // 创建管理员账号
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
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
  console.log('✅ Admin user created:', admin.username);

  // 创建编辑账号
  const editorPassword = await bcrypt.hash('editor123', 10);
  const editor = await prisma.user.upsert({
    where: { username: 'editor' },
    update: {},
    create: {
      username: 'editor',
      email: 'editor@example.com',
      passwordHash: editorPassword,
      role: 'editor',
      isActive: true,
    },
  });
  console.log('✅ Editor user created:', editor.username);

  // 创建查看者账号
  const viewerPassword = await bcrypt.hash('viewer123', 10);
  const viewer = await prisma.user.upsert({
    where: { username: 'viewer' },
    update: {},
    create: {
      username: 'viewer',
      email: 'viewer@example.com',
      passwordHash: viewerPassword,
      role: 'viewer',
      isActive: true,
    },
  });
  console.log('✅ Viewer user created:', viewer.username);

  // 创建默认知识库
  const defaultKB = await prisma.knowledgeBase.create({
    data: {
      name: '默认知识库',
      description: '系统默认知识库',
      config: {
        chunkSize: 500,
        overlap: 100,
        embeddingModel: 'bge-large-zh-v1.5',
        topK: 5,
        similarityThreshold: 0.3,
      },
      createdBy: admin.id,
    },
  });
  console.log('✅ Default knowledge base created:', defaultKB.name);

  // 创建测试知识库
  const testKB = await prisma.knowledgeBase.create({
    data: {
      name: '测试知识库',
      description: '用于测试的知识库',
      config: {
        chunkSize: 500,
        overlap: 100,
        embeddingModel: 'bge-large-zh-v1.5',
      },
      createdBy: editor.id,
    },
  });
  console.log('✅ Test knowledge base created:', testKB.name);

  console.log('\n🎉 Database seeding completed successfully!');
  console.log('\n📝 Login credentials:');
  console.log('   Admin:   admin / admin123');
  console.log('   Editor:  editor / editor123');
  console.log('   Viewer:  viewer / viewer123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
