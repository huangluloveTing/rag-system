/**
 * 配置模块
 */

import { Module, Global } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { AppConfigService } from './config.service';

@Global()
@Module({
  providers: [
    AppConfigService,
    {
      provide: 'ConfigService',
      useExisting: NestConfigService,
    },
  ],
  exports: [AppConfigService],
})
export class ConfigModule {}
