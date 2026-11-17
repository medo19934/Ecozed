import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from '../../config/app-config.service';
import { ChildrenModule } from '../children/children.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GOOGLE_VERIFIER, GoogleIdTokenVerifier } from './google-verifier';
import { TokenService } from './token.service';

@Module({
  imports: [
    ChildrenModule,
    JwtModule.registerAsync({
      global: true,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({ secret: config.get('JWT_ACCESS_SECRET') }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    { provide: GOOGLE_VERIFIER, useClass: GoogleIdTokenVerifier },
  ],
  exports: [AuthService],
})
export class AuthModule {}
