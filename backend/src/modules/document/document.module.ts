/**
 * 文档模块
 */

import { Module } from '@nestjs/common';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { MinioModule } from '../../common/minio/minio.module';
import { BullQueueModule } from '../../common/queue/bull-queue.module';

@Module({
  imports: [PrismaModule, MinioModule, BullQueueModule],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
