import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentAuth, Public, type AuthContext } from '../../common/decorators/auth.decorators';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  RequestOtpDto,
  ResetPasswordDto,
  SwitchDaycareDto,
  VerifyOtpDto,
} from './auth.dto';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Throttle({ otp: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  @Public()
  @Throttle({ otp: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('password/forgot')
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('password/reset')
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentAuth() auth: AuthContext) {
    return this.auth.me(auth.userId, auth.daycareId);
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Post('switch-daycare')
  switchDaycare(@CurrentAuth() auth: AuthContext, @Body() dto: SwitchDaycareDto) {
    return this.auth.switchDaycare(auth.userId, dto.daycareId);
  }
}
