import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from './token.service';

const config = {
  get: (k: string) =>
    ({ JWT_REFRESH_SECRET: 'refresh-secret', JWT_ACCESS_TTL: '15m', JWT_REFRESH_TTL_DAYS: 30 })[k],
};

const make = (record: unknown, updateCount = 1) => {
  const prisma = {
    raw: {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue(record),
        updateMany: jest.fn().mockResolvedValue({ count: updateCount }),
        create: jest.fn(),
      },
    },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('jwt') };
  return { svc: new TokenService(jwt as never, prisma as never, config as never), prisma, jwt };
};

describe('TokenService', () => {
  const base = {
    id: 'r1',
    familyId: 'f1',
    userId: 'u1',
    expiresAt: new Date(Date.now() + 1e6),
    revokedAt: null,
  };

  it('issues access + refresh with expiresIn in seconds', async () => {
    const { svc, prisma } = make(null);
    const t = await svc.issue({
      userId: 'u1',
      daycareId: 'd1',
      role: 'OWNER',
      isSuperAdmin: false,
    });
    expect(t.expiresIn).toBe(900);
    expect(t.refreshToken.length).toBeGreaterThan(20);
    expect(prisma.raw.refreshToken.create.mock.calls[0][0].data.tokenHash).not.toBe(t.refreshToken);
  });

  it('rotates a valid token', async () => {
    const { svc } = make(base);
    await expect(svc.consume('tok')).resolves.toMatchObject({ id: 'r1' });
  });

  it('revokes the family on reuse', async () => {
    const { svc, prisma } = make({ ...base, revokedAt: new Date() });
    await expect(svc.consume('tok')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.raw.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { familyId: 'f1', revokedAt: null } }),
    );
  });

  it('rejects expired tokens', async () => {
    const { svc } = make({ ...base, expiresAt: new Date(Date.now() - 1000) });
    await expect(svc.consume('tok')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
