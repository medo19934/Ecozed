import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
export const DOCUMENT_MIME = [
  ...IMAGE_MIME,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];
/** Chat attachments: documents, photos and voice notes. */
export const MESSAGE_MIME = [
  ...DOCUMENT_MIME,
  'image/heic',
  'image/gif',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/mpeg',
  'audio/3gpp',
  'audio/wav',
];

export interface UploadedBlob {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

/** Private object storage: local disk (dev), S3-compatible (MinIO/AWS) or Netlify Blobs. Never public URLs. */
/** Netlify Blobs store (only loaded when STORAGE_DRIVER=netlify; context comes from the function runtime). */
const blobs = async () =>
  (await import('@netlify/blobs')).getStore({ name: 'uploads', consistency: 'strong' });

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: 'local' | 's3' | 'netlify';
  private readonly root: string;
  private readonly bucket: string;
  private readonly s3?: S3Client;
  private bucketReady = false;

  constructor(config: AppConfig) {
    this.driver = config.get('STORAGE_DRIVER');
    this.root = resolve(config.get('STORAGE_LOCAL_DIR'));
    this.bucket = config.get('S3_BUCKET');
    if (this.driver === 's3') {
      this.s3 = new S3Client({
        region: config.get('S3_REGION'),
        endpoint: config.get('S3_ENDPOINT'),
        forcePathStyle: true,
        credentials: {
          accessKeyId: config.get('S3_ACCESS_KEY') ?? '',
          secretAccessKey: config.get('S3_SECRET_KEY') ?? '',
        },
      });
    }
  }

  /** Validates type/size and returns the stored key. */
  async save(prefix: string, file: UploadedBlob | undefined, allowed: string[]): Promise<string> {
    if (!file)
      throw new BadRequestException({ message: 'File is required', code: 'file_required' });
    // "audio/webm;codecs=opus" → "audio/webm"
    file.mimetype = file.mimetype.split(';')[0]!.trim().toLowerCase();
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException({ message: 'File type not allowed', code: 'file_type' });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException({ message: 'File too large', code: 'file_too_large' });
    }
    const key = `${prefix}/${randomUUID()}`;
    if (this.driver === 'netlify') {
      const ab = file.buffer.buffer.slice(
        file.buffer.byteOffset,
        file.buffer.byteOffset + file.buffer.byteLength,
      );
      await (await blobs()).set(key, ab as ArrayBuffer, { metadata: { mime: file.mimetype } });
    } else if (this.s3) {
      await this.ensureBucket();
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
    } else {
      const path = this.localPath(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, file.buffer);
    }
    return key;
  }

  async read(key: string): Promise<Buffer> {
    try {
      if (this.driver === 'netlify') {
        const data = await (await blobs()).get(key, { type: 'arrayBuffer' });
        if (!data) throw new Error('missing');
        return Buffer.from(data);
      }
      if (this.s3) {
        const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
        return Buffer.from(await res.Body!.transformToByteArray());
      }
      return await readFile(this.localPath(key));
    } catch {
      throw new NotFoundException({ message: 'File not found', code: 'not_found' });
    }
  }

  async remove(key: string): Promise<void> {
    try {
      if (this.driver === 'netlify') await (await blobs()).delete(key);
      else if (this.s3)
        await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      else await rm(this.localPath(key), { force: true });
    } catch (e) {
      this.logger.warn(`Failed to delete ${key}: ${(e as Error).message}`);
    }
  }

  private localPath(key: string): string {
    const path = resolve(join(this.root, key));
    if (!path.startsWith(this.root)) throw new BadRequestException('Invalid key');
    return path;
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketReady || !this.s3) return;
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
    this.bucketReady = true;
  }
}
