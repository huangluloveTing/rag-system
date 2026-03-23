/**
 * JWT Guard
 * 保护需要认证的路由
 */

import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * 处理认证结果
   */
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  /**
   * 处理认证错误
   */
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new Error('未授权访问');
    }
    return user;
  }
}
