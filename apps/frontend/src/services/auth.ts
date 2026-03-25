/**
 * 认证相关 API
 */
import { get, post, patch } from '@/utils/request';

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

// 后端 AuthResponseDto（简化前端需要的字段）
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt?: string;
}

/**
 * 用户登录
 */
export function login(data: LoginParams) {
  return post<AuthResponse>('/v1/auth/login', data);
}

/**
 * 用户注册
 */
export function register(data: RegisterParams) {
  return post<AuthResponse>('/v1/auth/register', data);
}

/**
 * 获取当前用户信息
 */
export function getCurrentUser() {
  return get<UserInfo>('/v1/users/me');
}

/**
 * 更新当前用户信息
 */
export function updateCurrentUser(data: Partial<Pick<UserInfo, 'username' | 'email'>>) {
  return patch<UserInfo>('/v1/users/me', data);
}

/**
 * 退出登录
 */
export function logout() {
  localStorage.removeItem('token');
  window.location.href = '/login';
}
