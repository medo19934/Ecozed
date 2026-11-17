import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from '../../config/app-config.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({ secret: config.get('JWT_ACCESS_SECRET') }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, OtpService],
  exports: [AuthService],
})
export class AuthModule {}
