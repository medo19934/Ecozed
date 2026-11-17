import { Module } from '@nestjs/common';
import { SubscriptionsAdminController, SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  // "mine" first so it isn't captured by the admin routes.
  controllers: [SubscriptionsController, SubscriptionsAdminController],
  providers: [SubscriptionsService],
})
export class SubscriptionsModule {}
