/**
 * Bull 队列模块
 */

import { Module, Global } from '@nestjs/common';
import { BullQueueService } from './bull-queue.service';
import { ConfigModule } from '../../config/config.module';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [BullQueueService],
  exports: [BullQueueService],
})
export class BullQueueModule {}
