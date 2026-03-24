/**
 * 检索模块
 */

import { Module } from '@nestjs/common';
import { RetrievalService } from './retrieval.service';
import { QdrantModule } from '../../common/qdrant/qdrant.module';
import { EmbeddingModule } from '../../common/embedding/embedding.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, QdrantModule, EmbeddingModule],
  providers: [RetrievalService],
  exports: [RetrievalService],
})
export class RetrievalModule {}