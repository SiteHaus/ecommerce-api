import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class R2Service {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly cdnUrl: string;

  constructor(private readonly config: ConfigService) {
    const accountId = config.getOrThrow('R2_ACCOUNT_ID');
    this.bucket = config.getOrThrow('R2_BUCKET_NAME');
    this.cdnUrl = config.getOrThrow('R2_CDN_URL');

    this.client = new S3Client({
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      region: 'auto',
      credentials: {
        accessKeyId: config.getOrThrow('R2_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow('R2_SECRET_ACCESS_KEY'),
      },
    });
  }

  async presignUpload(
    key: string,
    contentType: string,
    ttlSeconds = 900,
  ): Promise<{ uploadUrl: string; r2Key: string; cdnUrl: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: ttlSeconds,
    });
    return { uploadUrl, r2Key: key, cdnUrl: this.cdnUrlFor(key) };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  cdnUrlFor(key: string): string {
    return `${this.cdnUrl}/${key}`;
  }
}
