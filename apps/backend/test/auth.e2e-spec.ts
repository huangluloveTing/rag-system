/**
 * 认证模块 E2E 测试
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prismaService = app.get<PrismaService>(PrismaService);

    // 创建测试用户
    const passwordHash = await bcrypt.hash('test123', 10);
    await prismaService.user.upsert({
      where: { username: 'testuser' },
      update: {},
      create: {
        username: 'testuser',
        email: 'test@example.com',
        passwordHash,
        role: 'viewer',
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    // 清理测试数据
    await prismaService.user.delete({ where: { username: 'testuser' } });
    await app.close();
  });

  describe('/api/v1/auth/login (POST)', () => {
    it('should return token on successful login', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'test123',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
          expect(res.body).toHaveProperty('token_type', 'Bearer');
          authToken = res.body.access_token;
        });
    });

    it('should return 401 for invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('should return 400 for missing credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);
    });
  });

  describe('/api/v1/auth/register (POST)', () => {
    const newUsername = `newuser${Date.now()}`;

    it('should register new user', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          username: newUsername,
          email: `${newUsername}@example.com`,
          password: 'password123',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
        });
    });

    it('should return 409 for duplicate username', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'duplicate@example.com',
          password: 'password123',
        })
        .expect(409);
    });
  });

  describe('/api/v1/users/me (GET)', () => {
    beforeAll(async () => {
      // 获取认证 token
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'test123',
        });
      authToken = loginRes.body.access_token;
    });

    it('should return current user info', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('username', 'testuser');
          expect(res.body).toHaveProperty('email', 'test@example.com');
          expect(res.body).toHaveProperty('role', 'viewer');
        });
    });

    it('should return 401 without token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users/me')
        .expect(401);
    });
  });
});
