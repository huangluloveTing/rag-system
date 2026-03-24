/**
 * RAG System Backend - NestJS 应用入口
 *
 * 技术栈：NestJS 10 + TypeScript + Prisma + Bull Queue
 * 数据库：PostgreSQL 15 + Qdrant
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // 启用 CORS
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? false : true,
    credentials: true,
  });

  // 全局前缀
  const apiPrefix = configService.get('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动剥离未装饰的属性
      forbidNonWhitelisted: true, // 抛出错误而非静默剥离
      transform: true, // 自动转换类型
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger API 文档配置
  const config = new DocumentBuilder()
    .setTitle('RAG System API')
    .setDescription('RAG 智能知识库问答系统 API 文档')
    .setVersion('1.0')
    .addBearerAuth() // JWT 认证
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // 端口配置
  const port = configService.get('PORT', 3000);
  await app.listen(port);

  console.log(`🚀 RAG System Backend is running on: http://localhost:${port}`);
  console.log(`📍 API Prefix: ${apiPrefix}`);
  console.log(`📍 API Docs: http://localhost:${port}/api/docs`);
  console.log(`📍 Environment: ${configService.get('NODE_ENV', 'development')}`);
}

bootstrap();
