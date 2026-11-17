import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IdentifierSchema, type IssuedPassword } from '@latif/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentAuth, Roles, type AuthContext } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CredentialsService } from '../auth/credentials.service';

const AddAdminSchema = z.object({
  identifier: IdentifierSchema,
  fullName: z.string().trim().min(2).max(120).optional(),
});
class AddAdminDto extends createZodDto(AddAdminSchema) {}

/** General administration accounts (see all branches). Managed by general admins only. */
@Injectable()
export class AdminsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: CredentialsService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const users = await this.prisma.raw.user.findMany({
      where: { isSuperAdmin: true, deletedAt: null },
      select: { id: true, fullName: true, email: true, phone: true, lastLoginAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null }));
  }

  /** Promotes an existing account, or creates one with a one-time password. */
  async add(input: z.infer<typeof AddAdminSchema>): Promise<{ issued: IssuedPassword | null }> {
    const isEmail = input.identifier.includes('@');
    let user = await this.prisma.raw.user.findFirst({
      where: isEmail ? { email: input.identifier } : { phone: input.identifier },
    });
    if (user?.deletedAt)
      throw new BadRequestException({ code: 'account_disabled', message: 'Account disabled' });
    if (user) {
      await this.prisma.raw.user.update({ where: { id: user.id }, data: { isSuperAdmin: true } });
    } else {
      user = await this.prisma.raw.user.create({
        data: {
          fullName:
            input.fullName ?? (isEmail ? input.identifier.split('@')[0]! : input.identifier),
          ...(isEmail ? { email: input.identifier } : { phone: input.identifier }),
          isSuperAdmin: true,
        },
      });
    }
    await this.audit.log({
      action: 'admin.grant',
      entity: 'User',
      entityId: user.id,
      daycareId: null,
    });
    return { issued: user.passwordHash ? null : await this.credentials.issue(user.id) };
  }

  async remove(auth: AuthContext, userId: string) {
    if (userId === auth.userId)
      throw new BadRequestException({ code: 'forbidden_self', message: 'Not yourself' });
    await this.prisma.raw.user.update({ where: { id: userId }, data: { isSuperAdmin: false } });
    await this.audit.log({
      action: 'admin.revoke',
      entity: 'User',
      entityId: userId,
      daycareId: null,
    });
    return { ok: true };
  }
}

@ApiTags('admins')
@ApiBearerAuth()
@Roles('SUPER_ADMIN')
@Controller('admins')
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @Get()
  list() {
    return this.admins.list();
  }

  @Post()
  add(@Body() dto: AddAdminDto) {
    return this.admins.add(dto);
  }

  @Delete(':userId')
  remove(@CurrentAuth() auth: AuthContext, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.admins.remove(auth, userId);
  }
}

@Module({ controllers: [AdminsController], providers: [AdminsService] })
export class AdminsModule {}
