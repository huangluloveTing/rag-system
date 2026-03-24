/**
 * 聊天模块
 */

import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, RetrievalModule, LlmModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
