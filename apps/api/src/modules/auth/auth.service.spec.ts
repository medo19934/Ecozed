import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { GoogleIdentity } from './google-verifier';

const identity: GoogleIdentity = { sub: 'g-1', email: 'sara@example.com', name: 'Sara' };

const make = (
  opts: { existing?: Record<string, unknown> | null; env?: Record<string, unknown> } = {},
) => {
  const env: Record<string, unknown> = {
    SUPER_ADMIN_EMAILS: '',
    AUTH_DEV_LOGIN: false,
    ...opts.env,
  };
  const prisma = {
    raw: {
      user: {
        findFirst: jest.fn().mockResolvedValue(opts.existing ?? null),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'new', lastDaycareId: null, ...data }),
          ),
        update: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ ...opts.existing, ...data })),
      },
    },
  };
  const verifier = { verify: jest.fn().mockResolvedValue(identity) };
  const config = { get: (k: string) => env[k], isProd: false };
  const audit = { log: jest.fn() };
  const service = new AuthService(
    prisma as never,
    {} as never,
    audit as never,
    config as never,
    verifier,
  );
  const session = jest
    .spyOn(service as unknown as { session: () => Promise<unknown> }, 'session')
    .mockResolvedValue({ ok: true });
  return { service, prisma, verifier, audit, session };
};

describe('AuthService.google', () => {
  it('signs up a new parent from a verified Google identity', async () => {
    const { service, prisma, audit } = make();
    await service.google({ idToken: 'x'.repeat(30) });
    expect(prisma.raw.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'sara@example.com',
        googleId: 'g-1',
        isSuperAdmin: false,
      }),
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.signup_parent' }),
    );
  });

  it('links Google to a staff account created by an admin (matched by email)', async () => {
    const { service, prisma } = make({
      existing: { id: 'staff-1', googleId: null, isSuperAdmin: false },
    });
    await service.google({ idToken: 'x'.repeat(30) });
    expect(prisma.raw.user.create).not.toHaveBeenCalled();
    expect(prisma.raw.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'staff-1' },
        data: expect.objectContaining({ googleId: 'g-1' }),
      }),
    );
  });

  it('grants super admin to configured emails', async () => {
    const { service, prisma } = make({
      env: { SUPER_ADMIN_EMAILS: 'Owner@x.co, sara@example.com' },
    });
    await service.google({ idToken: 'x'.repeat(30) });
    expect(prisma.raw.user.create.mock.calls[0][0].data.isSuperAdmin).toBe(true);
  });

  it('rejects disabled accounts', async () => {
    const { service } = make({ existing: { id: 'u', deletedAt: new Date() } });
    await expect(service.google({ idToken: 'x'.repeat(30) })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('propagates invalid Google tokens', async () => {
    const { service, verifier } = make();
    verifier.verify.mockRejectedValueOnce(new UnauthorizedException());
    await expect(service.google({ idToken: 'x'.repeat(30) })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('AuthService.devLogin', () => {
  it('is disabled unless AUTH_DEV_LOGIN=true', async () => {
    const { service } = make();
    await expect(service.devLogin('a@b.co')).rejects.toBeInstanceOf(NotFoundException);
  });
});
