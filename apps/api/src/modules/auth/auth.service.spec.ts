import { ConflictException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

const makeService = (
  overrides: { user?: unknown; existing?: unknown; otpValid?: boolean } = {},
) => {
  const prisma = {
    raw: {
      user: {
        findFirst: jest
          .fn()
          .mockImplementation(({ where }) =>
            where.OR
              ? Promise.resolve(overrides.existing ?? null)
              : Promise.resolve(overrides.user ?? null),
          ),
      },
    },
  };
  const otp = {
    issue: jest.fn().mockResolvedValue('123456'),
    verify: jest.fn().mockResolvedValue(overrides.otpValid ?? false),
  };
  const tokens = { revokeAllForUser: jest.fn() };
  const audit = { log: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(true) };
  const sender = { send: jest.fn() };
  const service = new AuthService(
    prisma as never,
    tokens as never,
    otp as never,
    audit as never,
    config as never,
    sender,
  );
  return { service, prisma, otp, sender, audit };
};

describe('AuthService', () => {
  it('rejects duplicate registration', async () => {
    const { service } = makeService({ existing: { id: 'u1' } });
    await expect(
      service.register({
        fullName: 'A',
        email: 'a@b.co',
        phone: '+966500000000',
        password: 'password1',
        daycareName: 'X',
        locale: 'ar',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects wrong password with a generic error', async () => {
    const { service } = makeService({
      user: { id: 'u1', passwordHash: await bcrypt.hash('right-pass', 4) },
    });
    await expect(
      service.login({ identifier: 'a@b.co', password: 'wrong-pass' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects login for unknown user', async () => {
    const { service } = makeService();
    await expect(service.login({ identifier: 'a@b.co', password: 'x' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('does not send OTP or reveal unknown accounts', async () => {
    const { service, sender, otp } = makeService();
    await expect(
      service.requestOtp({ identifier: '+966500000000', purpose: 'LOGIN' }),
    ).resolves.toEqual({ sent: true });
    expect(otp.issue).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('sends OTP for known accounts (and echoes in dev)', async () => {
    const { service, sender } = makeService({ user: { id: 'u1' } });
    await expect(
      service.requestOtp({ identifier: '+966500000000', purpose: 'LOGIN' }),
    ).resolves.toEqual({
      sent: true,
      devCode: '123456',
    });
    expect(sender.send).toHaveBeenCalledWith('+966500000000', '123456', 'LOGIN');
  });

  it('rejects invalid OTP on verify', async () => {
    const { service } = makeService({ user: { id: 'u1' }, otpValid: false });
    await expect(
      service.verifyOtp({ identifier: '+966500000000', code: '000000' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
