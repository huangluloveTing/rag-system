/**
 * 认证响应 DTO
 */

import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({ description: '访问令牌', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;

  @ApiProperty({ description: '刷新令牌', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refresh_token?: string;

  @ApiProperty({ description: '令牌类型', example: 'Bearer' })
  token_type: string;

  @ApiProperty({ description: '过期时间（秒）', example: 86400 })
  expires_in: number;
}

export class UserInfoDto {
  @ApiProperty({ description: '用户 ID', example: 'uuid-xxx' })
  id: string;

  @ApiProperty({ description: '用户名', example: 'admin' })
  username: string;

  @ApiProperty({ description: '邮箱', example: 'admin@example.com' })
  email: string;

  @ApiProperty({ description: '角色', example: 'admin', enum: ['admin', 'editor', 'viewer'] })
  role: string;

  @ApiProperty({ description: '是否激活', example: true })
  isActive: boolean;

  @ApiProperty({ description: '创建时间', example: '2026-03-23T12:00:00Z' })
  createdAt: Date;
}
