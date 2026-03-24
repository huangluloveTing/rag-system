/**
 * 应用根模块
 * 导入所有功能模块
 */

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { DocumentModule } from './modules/document/document.module';
import { ChatModule } from './modules/chat/chat.module';
import { RetrievalModule } from './modules/retrieval/retrieval.module';
import { LlmModule } from './modules/llm/llm.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';
import { ConfigModule as AppConfigModule } from './config/config.module';
import { LoggerMiddleware } from './middlewares/logge';
import { QdrantModule } from './common/qdrant/qdrant.module';
import { EmbeddingModule } from './common/embedding/embedding.module';

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // 限流模块（防止 API 滥用）
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 分钟
        limit: 100, // 最多 100 个请求
      },
    ]),

    // 应用配置模块
    AppConfigModule,

    // Prisma 数据库模块
    PrismaModule,

    // 通用服务模块
    QdrantModule,
    EmbeddingModule,

    // 功能模块
    AuthModule,
    UserModule,
    DocumentModule,
    KnowledgeBaseModule,
    ChatModule,
    RetrievalModule,
    LlmModule,
    FeedbackModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
