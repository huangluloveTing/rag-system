// Prisma 配置文件
// Prisma 7+ 需要单独的配置文件

import { defineConfig, env } from 'prisma/config';
import dotenv from 'dotenv'
import path from 'path';

dotenv.config({
  path: path.join(process.cwd(), '.env.local')
})

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
