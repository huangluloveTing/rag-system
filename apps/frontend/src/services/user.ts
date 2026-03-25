/**
 * 用户相关 API
 */
import { get, put } from '@/utils/request';

// 用户信息
export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
}

// 更新用户信息参数
export interface UpdateUserParams {
  email?: string;
  password?: string;
}

/**
 * 获取当前用户信息
 */
export function getCurrentUser() {
  return get<User>('/v1/users/me');
}

/**
 * 更新当前用户信息
 */
export function updateCurrentUser(data: UpdateUserParams) {
  return put<User>('/v1/users/me', data);
}
