import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  FeatureToggle,
  type AuthResponse,
  type AuthUser,
  type ChangePasswordInput,
  type RegisterInput,
  type GoogleAuthInput,
  type Locale,
  type Role,
} from '@latif/shared';
import { RequestContext } from '../../common/context/request-context';
import { effectivePermissions } from '../../common/guards/permissions';
import { AppConfig } from '../../config/app-config.service';
import { csv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { GuardianLinkService } from '../children/guardian-link.service';
import { GOOGLE_VERIFIER, type GoogleIdentity, type GoogleVerifier } from './google-verifier';
import { hashPassword, verifyPassword } from './password';
import { TokenService } from './token.service';

export const DEFAULT_FEATURES: Record<FeatureToggle, boolean> = {
  [FeatureToggle.MESSAGES]: true,
  [FeatureToggle.CHILD_QR_ATTENDANCE]: true,
  [FeatureToggle.STAFF_GEOFENCED_ATTENDANCE]: false,
  [FeatureToggle.DAILY_STORY_AI]: false,
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
    @Inject(GOOGLE_VERIFIER) private readonly googleVerifier: GoogleVerifier,
    private readonly guardianLinks: GuardianLinkService,
  ) {}

  private meta() {
    const ctx = RequestContext.get();
    return { ip: ctx?.ip, userAgent: ctx?.userAgent };
  }

  private isSuperAdminEmail(email: string): boolean {
    return csv(this.config.get('SUPER_ADMIN_EMAILS'))
      .map((e) => e.toLowerCase())
      .includes(email);
  }

  /**
   * Google sign-up / sign-in. No codes or SMS.
   * - Existing account (by Google id, or by email for staff created by an admin) → sign in, link Google id.
   * - New email → parent self sign-up (no branch membership until a child is linked).
   */
  async google(input: GoogleAuthInput): Promise<AuthResponse> {
    const identity = await this.googleVerifier.verify(input.idToken);
    const user = await this.upsertFromGoogle(identity, input.locale);
    // Children added by staff before the parent signed up get linked now.
    await this.guardianLinks.linkUser(user);
    return this.session(user.id, user.lastDaycareId);
  }

  /**
   * Sign in with an email or phone number + password.
   * PUBLIC_DEMO only: no password needed and unknown identifiers become parent accounts.
   */
  async identifierLogin(
    identifier: string,
    password?: string,
    locale?: Locale,
  ): Promise<AuthResponse> {
    const demo = this.config.get('PUBLIC_DEMO');
    const isEmail = identifier.includes('@');
    let user = await this.prisma.raw.user.findFirst({
      where: isEmail ? { email: identifier } : { phone: identifier },
    });
    if (!demo) {
      const ok = await verifyPassword(password ?? '', user?.passwordHash ?? null);
      if (!user || !ok) {
        await this.audit.log({
          action: 'auth.login_failed',
          entity: 'User',
          entityId: user?.id ?? null,
          actorId: null,
          daycareId: null,
        });
        throw new UnauthorizedException({
          message: 'Wrong email/phone or password',
          code: 'invalid_credentials',
        });
      }
    }
    if (user?.deletedAt) {
      throw new UnauthorizedException({ message: 'Account disabled', code: 'account_disabled' });
    }
    if (!user) {
      user = await this.prisma.raw.user.create({
        data: {
          fullName: isEmail ? identifier.split('@')[0]! : identifier,
          ...(isEmail ? { email: identifier } : { phone: identifier }),
          locale: locale ?? 'ar',
          isSuperAdmin: isEmail && this.isSuperAdminEmail(identifier),
        },
      });
      await this.audit.log({
        action: 'auth.signup_parent',
        entity: 'User',
        entityId: user.id,
        actorId: user.id,
        daycareId: null,
      });
    }
    await this.audit.log({
      action: 'auth.login',
      entity: 'User',
      entityId: user.id,
      actorId: user.id,
    });
    if (demo) await this.guardianLinks.linkUser(user);
    return this.session(user.id, user.lastDaycareId);
  }

  /**
   * Parent self sign-up (email or phone + password). Children are linked by the branch
   * (child record / Parents page / accepted enrollment), never just by claiming a number.
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    const isEmail = input.identifier.includes('@');
    const existing = await this.prisma.raw.user.findFirst({
      where: isEmail ? { email: input.identifier } : { phone: input.identifier },
    });
    if (existing) {
      throw new ConflictException({ message: 'An account already exists', code: 'account_exists' });
    }
    const user = await this.prisma.raw.user.create({
      data: {
        fullName: input.fullName,
        ...(isEmail ? { email: input.identifier } : { phone: input.identifier }),
        locale: input.locale ?? 'ar',
        passwordHash: await hashPassword(input.password),
      },
    });
    await this.audit.log({
      action: 'auth.signup_parent',
      entity: 'User',
      entityId: user.id,
      actorId: user.id,
      daycareId: null,
    });
    return this.session(user.id, null);
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<{ ok: true }> {
    const user = await this.prisma.raw.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null },
    });
    // A temporary (admin-issued) password was just used to sign in: no need to type it again.
    if (user.passwordHash && !user.mustChangePassword) {
      if (!(await verifyPassword(input.currentPassword ?? '', user.passwordHash))) {
        throw new BadRequestException({
          message: 'Current password is wrong',
          code: 'wrong_password',
        });
      }
    }
    await this.prisma.raw.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(input.newPassword), mustChangePassword: false },
    });
    await this.audit.log({
      action: 'auth.password_changed',
      entity: 'User',
      entityId: userId,
      actorId: userId,
    });
    return { ok: true };
  }

  publicBranches() {
    return this.prisma.raw.daycare.findMany({
      where: { deletedAt: null },
      select: { slug: true, name: true, nameEn: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Local development sign-in without Google (AUTH_DEV_LOGIN=true only). */
  async devLogin(email: string): Promise<AuthResponse> {
    if (!this.config.get('AUTH_DEV_LOGIN') || this.config.isProd) throw new NotFoundException();
    const user = await this.upsertFromGoogle({
      sub: `dev:${email}`,
      email,
      name: email.split('@')[0]!,
    });
    await this.guardianLinks.linkUser(user);
    return this.session(user.id, user.lastDaycareId);
  }

  private async upsertFromGoogle(identity: GoogleIdentity, locale?: Locale) {
    const superAdmin = this.isSuperAdminEmail(identity.email);
    const existing = await this.prisma.raw.user.findFirst({
      where: { OR: [{ googleId: identity.sub }, { email: identity.email }] },
    });

    if (existing?.deletedAt) {
      throw new UnauthorizedException({ message: 'Account disabled', code: 'account_disabled' });
    }
    if (existing) {
      const user = await this.prisma.raw.user.update({
        where: { id: existing.id },
        data: {
          googleId: existing.googleId ?? identity.sub,
          avatarUrl: existing.avatarUrl ?? identity.picture,
          ...(superAdmin && !existing.isSuperAdmin ? { isSuperAdmin: true } : {}),
        },
      });
      await this.audit.log({
        action: 'auth.login_google',
        entity: 'User',
        entityId: user.id,
        actorId: user.id,
      });
      return user;
    }

    const user = await this.prisma.raw.user.create({
      data: {
        fullName: identity.name,
        email: identity.email,
        googleId: identity.sub,
        avatarUrl: identity.picture,
        locale: locale ?? 'ar',
        isSuperAdmin: superAdmin,
      },
    });
    await this.audit.log({
      action: superAdmin ? 'auth.signup_super_admin' : 'auth.signup_parent',
      entity: 'User',
      entityId: user.id,
      actorId: user.id,
      daycareId: null,
    });
    return user;
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const record = await this.tokens.consume(refreshToken);
    return this.session(record.userId, record.daycareId, record.familyId);
  }

  async logout(refreshToken: string): Promise<{ ok: true }> {
    await this.tokens.revoke(refreshToken);
    return { ok: true };
  }

  /** Branch switch: members of that branch, or super admins (any branch). */
  async switchDaycare(userId: string, daycareId: string): Promise<AuthResponse> {
    const user = await this.prisma.raw.user.findUniqueOrThrow({ where: { id: userId } });
    const allowed = user.isSuperAdmin
      ? await this.prisma.raw.daycare.findFirst({ where: { id: daycareId, deletedAt: null } })
      : await this.prisma.raw.membership.findFirst({
          where: { userId, daycareId, status: 'ACTIVE', deletedAt: null },
        });
    if (!allowed) throw new UnauthorizedException('Not allowed for this branch');
    await this.prisma.raw.user.update({
      where: { id: userId },
      data: { lastDaycareId: daycareId },
    });
    return this.session(userId, daycareId);
  }

  /** Builds the AuthUser view for the given active branch. */
  async me(userId: string, daycareId: string | null): Promise<AuthUser> {
    const user = await this.prisma.raw.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        memberships: {
          where: { status: 'ACTIVE', deletedAt: null, daycare: { deletedAt: null } },
          include: { daycare: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!user) throw new UnauthorizedException('User not found');

    // Super admins can act in every branch; others only where they hold a membership.
    const branches = user.isSuperAdmin
      ? (
          await this.prisma.raw.daycare.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true },
            orderBy: { createdAt: 'asc' },
          })
        ).map((d) => ({ daycareId: d.id, daycareName: d.name, role: 'SUPER_ADMIN' as Role }))
      : user.memberships.map((m) => ({
          daycareId: m.daycareId,
          daycareName: m.daycare.name,
          role: m.role as Role,
        }));

    const active = branches.find((b) => b.daycareId === daycareId) ?? branches[0] ?? null;
    const membership = user.memberships.find((m) => m.daycareId === active?.daycareId);
    // A signed-up parent without linked children has no membership yet → PARENT.
    const role: Role = user.isSuperAdmin
      ? 'SUPER_ADMIN'
      : ((membership?.role as Role | undefined) ?? 'PARENT');
    const features = active
      ? Object.fromEntries(
          (
            await this.prisma.raw.daycareFeature.findMany({
              where: { daycareId: active.daycareId },
            })
          ).map((f) => [f.key, f.enabled]),
        )
      : {};

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      locale: user.locale as Locale,
      isSuperAdmin: user.isSuperAdmin,
      daycareId: active?.daycareId ?? null,
      role,
      permissions: effectivePermissions(role, membership?.permissions ?? []),
      features,
      memberships: branches,
      mustChangePassword: user.mustChangePassword,
    };
  }

  private async session(
    userId: string,
    preferredDaycareId: string | null,
    familyId?: string,
  ): Promise<AuthResponse> {
    const user = await this.me(userId, preferredDaycareId);
    await this.prisma.raw.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
        ...(user.daycareId ? { lastDaycareId: user.daycareId } : {}),
      },
    });
    const tokens = await this.tokens.issue(
      {
        userId,
        daycareId: user.daycareId,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
        familyId,
      },
      this.meta(),
    );
    return { user, tokens };
  }
}
