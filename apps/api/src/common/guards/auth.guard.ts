import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { JwtAccessPayload } from '@latif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContext } from '../context/request-context';
import { IS_PUBLIC, type AuthContext } from '../decorators/auth.decorators';
import { effectivePermissions } from './permissions';

/** Global guard: verifies the access JWT and loads the active membership. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Missing access token');

    let payload: JwtAccessPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtAccessPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const user = await this.prisma.raw.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: { id: true, isSuperAdmin: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    let auth: AuthContext = {
      userId: user.id,
      daycareId: null,
      role: user.isSuperAdmin ? 'SUPER_ADMIN' : null,
      permissions: effectivePermissions(user.isSuperAdmin ? 'SUPER_ADMIN' : null, []),
      isSuperAdmin: user.isSuperAdmin,
    };

    if (payload.daycareId) {
      const m = await this.prisma.raw.membership.findFirst({
        where: {
          userId: user.id,
          daycareId: payload.daycareId,
          status: 'ACTIVE',
          deletedAt: null,
          daycare: { deletedAt: null },
        },
        select: { daycareId: true, role: true, permissions: true },
      });
      if (!m && !user.isSuperAdmin) throw new UnauthorizedException('Membership revoked');
      if (m) {
        auth = {
          ...auth,
          daycareId: m.daycareId,
          role: user.isSuperAdmin ? 'SUPER_ADMIN' : m.role,
          permissions: effectivePermissions(
            user.isSuperAdmin ? 'SUPER_ADMIN' : m.role,
            m.permissions,
          ),
        };
      }
    }

    req.auth = auth;
    RequestContext.assign(auth);
    return true;
  }
}
