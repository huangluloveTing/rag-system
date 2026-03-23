// Prisma 配置文件
// Prisma 7+ 需要单独的配置文件

import { defineConfig, env } from 'prisma/config';

type Env = {
  DATABASE_URL: string
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL
  },
});
