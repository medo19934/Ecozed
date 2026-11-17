import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentAuth, Public, type AuthContext } from '../../common/decorators/auth.decorators';
import {
  ChangePasswordDto,
  DevLoginDto,
  GoogleAuthDto,
  IdentifierLoginDto,
  RefreshTokenDto,
  RegisterDto,
  SwitchDaycareDto,
} from './auth.dto';
import { AuthService } from './auth.service';
import { AppConfig } from '../../config/app-config.service';
import { DemoService } from '../demo/demo.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly demo: DemoService,
    private readonly config: AppConfig,
  ) {}

  /** Public demo: role cards for the login page (empty unless PUBLIC_DEMO=true). */
  @Public()
  @Get('demo-accounts')
  demoAccounts() {
    return this.config.get('PUBLIC_DEMO') ? this.demo.accounts() : [];
  }

  /** Public settings the sign-in screens need. */
  @Public()
  @Get('options')
  async options() {
    return {
      publicDemo: this.config.get('PUBLIC_DEMO'),
      google: this.config.get('GOOGLE_CLIENT_IDS').length > 0,
      // Branch names for the role cards on the sign-in screens.
      branches: await this.auth.publicBranches(),
    };
  }

  /** Sign up or sign in with Google (ID token). */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('google')
  google(@Body() dto: GoogleAuthDto) {
    return this.auth.google(dto);
  }

  /** Sign in with email or phone + password (no password needed only when PUBLIC_DEMO=true). */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: IdentifierLoginDto) {
    return this.auth.identifierLogin(dto.identifier, dto.password, dto.locale);
  }

  /** Parent self sign-up with email or phone + password. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Post('password')
  changePassword(@CurrentAuth() auth: AuthContext, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(auth.userId, dto);
  }

  /** Local development only (AUTH_DEV_LOGIN=true). Returns 404 otherwise. */
  @Public()
  @HttpCode(200)
  @Post('dev-login')
  devLogin(@Body() dto: DevLoginDto) {
    return this.auth.devLogin(dto.email);
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
