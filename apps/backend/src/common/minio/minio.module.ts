/**
 * MinIO 模块
 */

import { Module, Global } from '@nestjs/common';
import { MinioService } from './minio.service';
import { ConfigModule } from '../../config/config.module';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [MinioService],
  exports: [MinioService],
})
export class MinioModule {}
