/**
 * 认证服务单元测试
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return token on successful login', async () => {
      const mockUser = {
        id: 'test-id',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'viewer',
        isActive: true,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue('fake-token');

      const result = await authService.login({
        username: 'testuser',
        password: 'password123',
      });

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('token_type', 'Bearer');
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'testuser' },
        select: expect.any(Object),
      });
    });

    it('should throw UnauthorizedException for invalid username', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ username: 'invalid', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      const mockUser = {
        id: 'test-id',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'viewer',
        isActive: true,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        authService.login({ username: 'testuser', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const mockUser = {
        id: 'test-id',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'viewer',
        isActive: false,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        authService.login({ username: 'testuser', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('should create user and return token on successful registration', async () => {
      const mockCreatedUser = {
        id: 'test-id',
        username: 'newuser',
        email: 'new@example.com',
        role: 'viewer',
        isActive: true,
      };

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockCreatedUser);
      mockJwtService.signAsync.mockResolvedValue('fake-token');

      const result = await authService.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('access_token');
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: 'newuser',
          email: 'new@example.com',
          role: 'viewer',
        }),
        select: expect.any(Object),
      });
    });

    it('should throw ConflictException for existing username', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'existing-id',
        username: 'existing',
      });

      await expect(
        authService.register({
          username: 'existing',
          email: 'new@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('validateUser', () => {
    it('should return user without password', async () => {
      const mockUser = {
        id: 'test-id',
        username: 'testuser',
        email: 'test@example.com',
        role: 'viewer',
        isActive: true,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.validateUser('test-id');

      expect(result).toEqual(mockUser);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should return null for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await authService.validateUser('invalid-id');

      expect(result).toBeNull();
    });
  });
});
