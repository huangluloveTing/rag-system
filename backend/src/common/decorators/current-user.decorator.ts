/**
 * 当前用户装饰器
 * 从请求中提取用户信息
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserType {
  id: string;
  username: string;
  email: string;
  role: string;
}

/**
 * @CurrentUser() 装饰器
 * 在 Controller 方法中使用，获取当前登录用户信息
 * 
 * 示例：
 * @Get('profile')
 * getProfile(@CurrentUser() user: CurrentUserType) {
 *   return user;
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
