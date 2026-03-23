/**
 * 角色守卫
 * 基于 RBAC 的权限控制
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';

/**
 * 角色装饰器
 * 用于标记路由需要的角色权限
 */
export const Roles = (...roles: string[]) => {
  return (target: any, key?: any, descriptor?: any) => {
    return Reflect.defineMetadata(ROLES_KEY, roles, descriptor?.value || target);
  };
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 如果没有设置角色要求，允许访问
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user) {
      throw new ForbiddenException('未授权访问');
    }

    // 检查用户角色是否在允许的角色列表中
    const hasRole = requiredRoles.some((role) => user.role === role);
    
    if (!hasRole) {
      throw new ForbiddenException(`需要以下角色权限：${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
