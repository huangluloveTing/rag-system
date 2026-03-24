/**
 * Qdrant 模块
 */

import { Module, Global } from '@nestjs/common';
import { QdrantService } from './qdrant.service';

@Global()
@Module({
  providers: [QdrantService],
  exports: [QdrantService],
})
export class QdrantModule {}