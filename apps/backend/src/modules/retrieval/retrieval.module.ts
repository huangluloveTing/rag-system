/**
 * 检索模块（占位）
 * Phase 2 实现
 */

import { Module } from '@nestjs/common';
import { RetrievalService } from './retrieval.service';
import { MilvusService } from './milvus.service';

@Module({
  providers: [RetrievalService, MilvusService],
  exports: [RetrievalService, MilvusService],
})
export class RetrievalModule {}
