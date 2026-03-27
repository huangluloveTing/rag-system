/**
 * Bull 队列模块
 */

import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullQueueService } from './bull-queue.service';
import { DocumentQueueProcessor } from './document-queue.processor';
import { DocumentProcessor } from '../processor/document-processor.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { MinioModule } from '../minio/minio.module';
import { QdrantModule } from '../qdrant/qdrant.module';
import { EmbeddingModule } from '../embedding/embedding.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_URL')?.replace('redis://', '').split(':')[0] || 'localhost',
          port: parseInt(configService.get('REDIS_URL')?.split(':')[2] || '6379', 10),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'document-processing',
    }),
    PrismaModule,
    MinioModule,
    QdrantModule,
    EmbeddingModule,
  ],
  providers: [BullQueueService, DocumentQueueProcessor, DocumentProcessor],
  exports: [BullQueueService],
})
export class BullQueueModule {}
