/**
 * 认证相关 API
 */
import { get, post } from '@/utils/request';

// 登录请求参数
export interface LoginParams {
  username: string;
  password: string;
}

// 注册请求参数
export interface RegisterParams {
  username: string;
  email: string;
  password: string;
}

// 登录响应
export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

/**
 * 用户登录
 */
export function login(data: LoginParams) {
  return post<LoginResponse>('/v1/auth/login', data);
}

/**
 * 用户注册
 */
export function register(data: RegisterParams) {
  return post<LoginResponse>('/v1/auth/register', data);
}

/**
 * 获取当前用户信息
 */
export function getCurrentUser() {
  return get('/v1/users/me');
}

/**
 * 退出登录
 */
export function logout() {
  localStorage.removeItem('token');
  window.location.href = '/login';
}
