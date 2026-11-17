import { Global, Module } from '@nestjs/common';
import { LoggingOtpSender, OTP_SENDER } from './otp-sender';

@Global()
@Module({
  providers: [{ provide: OTP_SENDER, useClass: LoggingOtpSender }],
  exports: [OTP_SENDER],
})
export class NotificationsModule {}
