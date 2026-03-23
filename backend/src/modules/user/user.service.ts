/**
 * 用户服务
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserInfoDto } from '../auth/dto/auth-response.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取用户信息
   */
  async getUserById(userId: string): Promise<UserInfoDto> {
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
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(userId: string): Promise<UserInfoDto> {
    return this.getUserById(userId);
  }

  /**
   * 更新用户信息
   */
  async updateUser(userId: string, data: Partial<UserInfoDto>): Promise<UserInfoDto> {
    // 只能更新部分字段
    const allowedFields = ['email'];
    const updateData: any = {};

    for (const field of allowedFields) {
      if (data[field as keyof UserInfoDto] !== undefined) {
        updateData[field] = data[field as keyof UserInfoDto];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('没有可更新的字段');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return user;
  }
}
