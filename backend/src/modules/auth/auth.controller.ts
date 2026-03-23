/**
 * 认证控制器
 * 提供登录、注册、刷新 Token 等接口
 */

import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({ status: 200, description: '登录成功', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: '用户名或密码错误' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '用户注册' })
  @ApiResponse({ status: 201, description: '注册成功', type: AuthResponseDto })
  @ApiResponse({ status: 409, description: '用户名或邮箱已被注册' })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新 Token' })
  @ApiResponse({ status: 200, description: '刷新成功', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: '无效的刷新令牌' })
  async refresh(@Body('refresh_token') refreshToken: string): Promise<AuthResponseDto> {
    return this.authService.refreshToken(refreshToken);
  }
}
