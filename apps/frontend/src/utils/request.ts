/**
 * Axios 请求封装
 * 负责 JWT 认证、请求拦截、响应拦截、错误处理
 */
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { message } from 'antd';

// 响应数据结构
export interface ResponseData<T = any> {
  code: number;
  data: T;
  message?: string;
}

// 创建 axios 实例
const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加 JWT Token
request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器 - 统一处理错误
request.interceptors.response.use(
  (response: AxiosResponse) => {
    // NestJS 默认直接返回数据，包装为统一格式
    return {
      ...response,
      data: {
        code: 0,
        data: response.data,
        message: 'success',
      },
    };
  },
  (error) => {
    console.error('Response error:', error);

    // 网络错误
    if (!error.response) {
      message.error('网络连接失败，请检查网络');
      return Promise.reject(error);
    }

    const status = error.response.status;

    switch (status) {
      case 401:
        message.error('未授权，请重新登录');
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        break;
      case 403:
        message.error('拒绝访问');
        break;
      case 404:
        message.error('请求的资源不存在');
        break;
      case 500:
        message.error('服务器内部错误');
        break;
      default:
        message.error(error.response.data?.message || '请求失败');
    }

    return Promise.reject(error);
  }
);

/**
 * 封装 GET 请求
 */
export function get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ResponseData<T>> {
  return request.get(url, config);
}

/**
 * 封装 POST 请求
 */
export function post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ResponseData<T>> {
  return request.post(url, data, config);
}

/**
 * 封装 PUT 请求
 */
export function put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ResponseData<T>> {
  return request.put(url, data, config);
}

/**
 * 封装 DELETE 请求
 */
export function del<T = any>(url: string, config?: AxiosRequestConfig): Promise<ResponseData<T>> {
  return request.delete(url, config);
}

/**
 * 封装上传文件请求
 */
export function upload<T = any>(url: string, file: File, data?: Record<string, any>, config?: AxiosRequestConfig): Promise<ResponseData<T>> {
  const formData = new FormData();
  formData.append('file', file);
  if (data) {
    Object.keys(data).forEach((key) => {
      formData.append(key, data[key]);
    });
  }
  
  return request.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    ...config,
  });
}

export default request;
