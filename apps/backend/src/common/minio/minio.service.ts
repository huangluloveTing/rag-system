/**
 * MinIO 服务
 * 提供对象存储操作
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import { AppConfigService } from '../../config/config.service';

@Injectable()
export class MinioService {
  private readonly client: Minio.Client;
  private readonly logger = new Logger(MinioService.name);

  constructor(
    private configService: AppConfigService,
  ) {
    const minioConfig = this.configService.minio;
    
    // 解析 endpoint，分离 host 和 port
    const [host, port] = minioConfig.endPoint.split(':');
    
    this.client = new Minio.Client({
      endPoint: host,
      port: port ? parseInt(port, 10) : 9000,
      useSSL: minioConfig.useSSL,
      accessKey: minioConfig.accessKey,
      secretKey: minioConfig.secretKey,
    });
  }

  /**
   * 确保 bucket 存在
   */
  async ensureBucketExists(bucketName: string): Promise<void> {
    try {
      const exists = await this.client.bucketExists(bucketName);
      if (!exists) {
        await this.client.makeBucket(bucketName);
        this.logger.log(`Bucket "${bucketName}" created`);
        
        // 设置 bucket 策略为公开读取（可选）
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: '*' },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${bucketName}/*`],
            },
          ],
        };
        await this.client.setBucketPolicy(bucketName, JSON.stringify(policy));
      }
    } catch (error) {
      this.logger.error(`Error ensuring bucket exists: ${error.message}`);
      throw error;
    }
  }

  /**
   * 上传文件
   * @param file - Express.Multer.File 对象
   * @param bucketName - bucket 名称
   * @param folder - 可选的文件夹路径
   * @returns 文件路径
   */
  async uploadFile(
    file: Express.Multer.File,
    bucketName: string = 'rag-documents',
    folder?: string,
  ): Promise<string> {
    try {
      await this.ensureBucketExists(bucketName);

      // 生成唯一的文件路径
      const fileExt = this.getFileExtension(file.originalname);
      const fileName = `${uuidv4()}${fileExt}`;
      const objectName = folder ? `${folder}/${fileName}` : fileName;

      // 上传文件
      await this.client.putObject(
        bucketName,
        objectName,
        file.buffer,
        file.size,
        {
          'Content-Type': file.mimetype,
          'X-Amz-Meta-Original-Name': file.originalname,
        },
      );

      this.logger.log(`File uploaded: ${objectName}`);
      return objectName;
    } catch (error) {
      this.logger.error(`Error uploading file: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取文件
   * @param bucketName - bucket 名称
   * @param objectName - 对象名称
   * @returns 文件流
   */
  async getFile(bucketName: string, objectName: string): Promise<NodeJS.ReadableStream> {
    try {
      return await this.client.getObject(bucketName, objectName);
    } catch (error) {
      this.logger.error(`Error getting file: ${error.message}`);
      throw error;
    }
  }

  /**
   * 下载文件为 Buffer
   * @param bucketName - bucket 名称
   * @param objectName - 对象名称
   * @returns 文件 Buffer
   */
  async downloadFile(bucketName: string, objectName: string): Promise<Buffer> {
    try {
      const stream = await this.client.getObject(bucketName, objectName);
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        stream.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        stream.on('error', (error) => {
          this.logger.error(`Error downloading file: ${error.message}`);
          reject(error);
        });
      });
    } catch (error) {
      this.logger.error(`Error downloading file: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取文件预签名 URL（用于临时访问）
   * @param bucketName - bucket 名称
   * @param objectName - 对象名称
   * @param expiry - 过期时间（秒），默认 7 天
   * @returns 预签名 URL
   */
  async getPresignedUrl(
    bucketName: string,
    objectName: string,
    expiry: number = 604800, // 7 天
  ): Promise<string> {
    try {
      return await this.client.presignedGetObject(bucketName, objectName, expiry);
    } catch (error) {
      this.logger.error(`Error getting presigned URL: ${error.message}`);
      throw error;
    }
  }

  /**
   * 删除文件
   * @param bucketName - bucket 名称
   * @param objectName - 对象名称
   */
  async deleteFile(bucketName: string, objectName: string): Promise<void> {
    try {
      await this.client.removeObject(bucketName, objectName);
      this.logger.log(`File deleted: ${objectName}`);
    } catch (error) {
      this.logger.error(`Error deleting file: ${error.message}`);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(bucketName: string, objectName: string): Promise<boolean> {
    try {
      await this.client.statObject(bucketName, objectName);
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filename: string): string {
    const ext = filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
    return ext ? `.${ext}` : '';
  }
}
