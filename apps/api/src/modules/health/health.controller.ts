import { Controller, Get, OnModuleDestroy } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import Redis from 'ioredis';
import { Public } from '../../common/decorators/auth.decorators';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    config: AppConfig,
  ) {
    this.redis = new Redis(config.get('REDIS_URL'), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.redis.on('error', () => undefined);
  }

  @Public()
  @Get()
  async check() {
    const [db, redis] = await Promise.all([
      this.prisma.raw.$queryRaw`SELECT 1`.then(() => 'up' as const).catch(() => 'down' as const),
      (this.redis.status === 'wait' ? this.redis.connect() : Promise.resolve())
        .then(() => this.redis.ping())
        .then(() => 'up' as const)
        .catch(() => 'down' as const),
    ]);
    return { status: db === 'up' ? 'ok' : 'error', db, redis, time: new Date().toISOString() };
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
