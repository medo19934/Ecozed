import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import {
  ALL_STAFF_PERMISSIONS,
  FeatureToggle,
  TRIAL_DAYS,
  type AuthResponse,
  type AuthUser,
  type ForgotPasswordInput,
  type Locale,
  type LoginInput,
  type RegisterInput,
  type RequestOtpInput,
  type ResetPasswordInput,
  type Role,
  type VerifyOtpInput,
} from '@latif/shared';
import { RequestContext } from '../../common/context/request-context';
import { effectivePermissions } from '../../common/guards/permissions';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OTP_SENDER, type OtpSender } from '../notifications/otp-sender';
import { daycareSlug, isEmail } from './crypto.util';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

const BCRYPT_ROUNDS = 10;

export const DEFAULT_FEATURES: Record<FeatureToggle, boolean> = {
  [FeatureToggle.MESSAGES]: true,
  [FeatureToggle.CHILD_QR_ATTENDANCE]: true,
  [FeatureToggle.PARENT_IN_APP_PAYMENT]: false,
  [FeatureToggle.STAFF_GEOFENCED_ATTENDANCE]: false,
};

export interface OtpRequestResult {
  sent: true;
  /** Only present when OTP_DEV_ECHO=true (dev/test). */
  devCode?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly otp: OtpService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
    @Inject(OTP_SENDER) private readonly otpSender: OtpSender,
  ) {}

  private meta() {
    const ctx = RequestContext.get();
    return { ip: ctx?.ip, userAgent: ctx?.userAgent };
  }

  private findByIdentifier(identifier: string) {
    return this.prisma.raw.user.findFirst({
      where: {
        ...(isEmail(identifier) ? { email: identifier } : { phone: identifier }),
        deletedAt: null,
      },
    });
  }

  /** Onboarding step 1: owner account + daycare on a free trial. */
  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await this.prisma.raw.user.findFirst({
      where: { OR: [{ email: input.email }, { phone: input.phone }] },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException({ message: 'Account already exists', code: 'account_exists' });

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const { user, daycare } = await this.prisma.raw.$transaction(async (tx) => {
      const daycare = await tx.daycare.create({
        data: {
          name: input.daycareName,
          slug: daycareSlug(input.daycareName),
          phone: input.phone,
          email: input.email,
          defaultLocale: input.locale,
          trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86400_000),
          features: {
            create: Object.entries(DEFAULT_FEATURES).map(([key, enabled]) => ({ key, enabled })),
          },
        },
      });
      const user = await tx.user.create({
        data: {
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          passwordHash,
          locale: input.locale,
          lastDaycareId: daycare.id,
          memberships: {
            create: {
              daycareId: daycare.id,
              role: 'OWNER',
              permissions: [...ALL_STAFF_PERMISSIONS],
            },
          },
        },
      });
      return { user, daycare };
    });

    await this.audit.log({
      action: 'auth.register',
      entity: 'Daycare',
      entityId: daycare.id,
      actorId: user.id,
      daycareId: daycare.id,
    });
    return this.session(user.id, daycare.id);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.findByIdentifier(input.identifier);
    const ok = user?.passwordHash ? await bcrypt.compare(input.password, user.passwordHash) : false;
    if (!user || !ok) {
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        code: 'invalid_credentials',
      });
    }
    await this.audit.log({
      action: 'auth.login',
      entity: 'User',
      entityId: user.id,
      actorId: user.id,
    });
    return this.session(user.id, user.lastDaycareId);
  }

  async requestOtp(input: RequestOtpInput): Promise<OtpRequestResult> {
    const user = await this.findByIdentifier(input.identifier);
    // Do not reveal whether the account exists.
    if (!user) return { sent: true };
    const code = await this.otp.issue(input.identifier, input.purpose);
    await this.otpSender.send(input.identifier, code, input.purpose);
    return this.config.get('OTP_DEV_ECHO') ? { sent: true, devCode: code } : { sent: true };
  }

  /** Passwordless login (parents via phone). */
  async verifyOtp(input: VerifyOtpInput): Promise<AuthResponse> {
    const valid = await this.otp.verify(input.identifier, 'LOGIN', input.code);
    const user = valid ? await this.findByIdentifier(input.identifier) : null;
    if (!user) throw new UnauthorizedException({ message: 'Invalid code', code: 'invalid_code' });
    await this.audit.log({
      action: 'auth.login_otp',
      entity: 'User',
      entityId: user.id,
      actorId: user.id,
    });
    return this.session(user.id, user.lastDaycareId);
  }

  forgotPassword(input: ForgotPasswordInput): Promise<OtpRequestResult> {
    return this.requestOtp({ identifier: input.identifier, purpose: 'RESET_PASSWORD' });
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ ok: true }> {
    const valid = await this.otp.verify(input.identifier, 'RESET_PASSWORD', input.code);
    const user = valid ? await this.findByIdentifier(input.identifier) : null;
    if (!user) throw new BadRequestException({ message: 'Invalid code', code: 'invalid_code' });
    await this.prisma.raw.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS) },
    });
    await this.tokens.revokeAllForUser(user.id);
    await this.audit.log({
      action: 'auth.password_reset',
      entity: 'User',
      entityId: user.id,
      actorId: user.id,
      daycareId: null,
    });
    return { ok: true };
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const record = await this.tokens.consume(refreshToken);
    return this.session(record.userId, record.daycareId, record.familyId);
  }

  async logout(refreshToken: string): Promise<{ ok: true }> {
    await this.tokens.revoke(refreshToken);
    return { ok: true };
  }

  async switchDaycare(userId: string, daycareId: string): Promise<AuthResponse> {
    const user = await this.prisma.raw.user.findUniqueOrThrow({ where: { id: userId } });
    const m = await this.prisma.raw.membership.findFirst({
      where: { userId, daycareId, status: 'ACTIVE', deletedAt: null },
    });
    if (!m && !user.isSuperAdmin) throw new UnauthorizedException('Not a member of this daycare');
    await this.prisma.raw.user.update({
      where: { id: userId },
      data: { lastDaycareId: daycareId },
    });
    return this.session(userId, daycareId);
  }

  /** Builds the AuthUser view for the given active daycare. */
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

    const active = user.memberships.find((m) => m.daycareId === daycareId) ?? null;
    const role: Role | null = user.isSuperAdmin ? 'SUPER_ADMIN' : (active?.role ?? null);
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
      locale: user.locale as Locale,
      isSuperAdmin: user.isSuperAdmin,
      daycareId: active?.daycareId ?? null,
      role,
      permissions: effectivePermissions(role, active?.permissions ?? []),
      features,
      memberships: user.memberships.map((m) => ({
        daycareId: m.daycareId,
        daycareName: m.daycare.name,
        role: m.role,
      })),
    };
  }

  /** Picks an active membership (preferred id, else first) and issues tokens. */
  private async session(
    userId: string,
    preferredDaycareId: string | null,
    familyId?: string,
  ): Promise<AuthResponse> {
    let user = await this.me(userId, preferredDaycareId);
    if (!user.daycareId && user.memberships[0]) {
      user = await this.me(userId, user.memberships[0].daycareId);
    }
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
