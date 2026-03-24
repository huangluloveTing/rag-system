/**
 * 检索模块（占位）
 * Phase 2 实现
 */

import { Module } from '@nestjs/common';
import { RetrievalService } from './retrieval.service';
import { QdrantService } from './qdrant.service';

@Module({
  providers: [RetrievalService, QdrantService],
  exports: [RetrievalService, QdrantService],
})
export class RetrievalModule {}
