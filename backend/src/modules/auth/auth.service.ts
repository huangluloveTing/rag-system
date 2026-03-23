/**
 * 认证服务
 * 处理用户登录、注册、Token 生成等认证逻辑
 */

import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto, UserInfoDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * 用户登录
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { username, password } = loginDto;

    // 查找用户
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        email: true,
        passwordHash: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('账号已被禁用');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 生成 Token
    const tokens = await this.generateTokens(user);

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_in: this.getExpirationInSeconds(),
    };
  }

  /**
   * 用户注册
   */
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { username, email, password } = registerDto;

    // 检查用户名是否已存在
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      throw new ConflictException('用户名或邮箱已被注册');
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 创建用户（默认为 viewer 角色）
    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: 'viewer',
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    // 生成 Token
    const tokens = await this.generateTokens(user);

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_in: this.getExpirationInSeconds(),
    };
  }

  /**
   * 刷新 Token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('用户不存在或已被禁用');
      }

      const tokens = await this.generateTokens(user);

      return {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_type: 'Bearer',
        expires_in: this.getExpirationInSeconds(),
      };
    } catch (error) {
      throw new UnauthorizedException('无效的刷新令牌');
    }
  }

  /**
   * 验证用户（被 JWT Strategy 调用）
   */
  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    return user;
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(userId: string): Promise<UserInfoDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    return user;
  }

  /**
   * 生成访问令牌和刷新令牌
   */
  private async generateTokens(user: any) {
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRATION', '24h'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * 获取过期时间（秒）
   */
  private getExpirationInSeconds(): number {
    const expiration = this.configService.get<string>('JWT_EXPIRATION', '24h');
    // 解析类似 "24h" 的字符串为秒数
    const match = expiration.match(/^(\d+)([hms])$/);
    if (!match) return 86400; // 默认 24 小时

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'h':
        return value * 3600;
      case 'm':
        return value * 60;
      case 's':
        return value;
      default:
        return 86400;
    }
  }
}
