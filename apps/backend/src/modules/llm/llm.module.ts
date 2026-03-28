/**
 * LLM 模块（占位）
 * Phase 3 实现
 */

import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { RetrievalModule } from '../retrieval/retrieval.module';

@Module({
  imports: [RetrievalModule],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
