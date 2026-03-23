/**
 * 用户控制器
 */

import { Controller, Get, Body, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CurrentUser, CurrentUserType } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserInfoDto } from '../auth/dto/auth-response.dto';

@ApiTags('用户')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '获取成功', type: UserInfoDto })
  async getCurrentUser(@CurrentUser() user: CurrentUserType): Promise<UserInfoDto> {
    return this.userService.getCurrentUser(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: '更新当前用户信息' })
  @ApiResponse({ status: 200, description: '更新成功', type: UserInfoDto })
  async updateCurrentUser(
    @CurrentUser() user: CurrentUserType,
    @Body() updateData: Partial<UserInfoDto>,
  ): Promise<UserInfoDto> {
    return this.userService.updateUser(user.id, updateData);
  }
}
