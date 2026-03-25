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

function normalizeResponseData<T = any>(raw: any): ResponseData<T> {
  // 已经是标准格式：{ code, data, message }
  if (raw && typeof raw === 'object' && typeof raw.code === 'number' && 'data' in raw) {
    return raw as ResponseData<T>;
  }

  // 后端直接返回 DTO：视为成功
  return {
    code: 0,
    data: raw as T,
  };
}

// 响应拦截器 - 统一处理错误 + 兼容后端非包装响应
request.interceptors.response.use(
  ((response: AxiosResponse) => {
    const res = normalizeResponseData(response.data);

    // 如果返回的状态码不是 0，说明接口有错误
    if (res.code !== 0) {
      message.error(res.message || '接口请求失败');

      // 401: 未授权，跳转到登录页
      if (res.code === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }

      return Promise.reject(new Error(res.message || '接口请求失败'));
    }

    return res;
  }) as any,
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
export function post<T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<ResponseData<T>> {
  return request.post(url, data, config);
}

/**
 * 封装 PUT 请求
 */
export function put<T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<ResponseData<T>> {
  return request.put(url, data, config);
}

/**
 * 封装 PATCH 请求
 */
export function patch<T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<ResponseData<T>> {
  return request.patch(url, data, config);
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
export function upload<T = any>(
  url: string,
  file: File,
  data?: Record<string, any>,
  config?: AxiosRequestConfig
): Promise<ResponseData<T>> {
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
