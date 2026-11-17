import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CreateSubscriptionSchema,
  MarkPaidSchema,
  PlanSchema,
  StaffPermission,
  SubscriptionListQuerySchema,
} from '@latif/shared';
import { createZodDto } from 'nestjs-zod';
import {
  CurrentAuth,
  RequirePermissions,
  Roles,
  type AuthContext,
} from '../../common/decorators/auth.decorators';
import { SubscriptionsService } from './subscriptions.service';

class PlanDto extends createZodDto(PlanSchema) {}
class CreateDto extends createZodDto(CreateSubscriptionSchema) {}
class ListDto extends createZodDto(SubscriptionListQuerySchema) {}
class PaidDto extends createZodDto(MarkPaidSchema) {}

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  /** Parent: read-only status of own children. */
  @Get('mine')
  mine(@CurrentAuth() auth: AuthContext) {
    return this.subs.mine(auth.userId);
  }
}

/** Admin + branch manager (and staff granted canManagePayments), own branch. */
@ApiTags('subscriptions')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
@RequirePermissions(StaffPermission.CAN_MANAGE_PAYMENTS)
@Controller('subscriptions')
export class SubscriptionsAdminController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Get()
  list(@Query() q: ListDto) {
    return this.subs.list(q);
  }

  @Post()
  create(@Body() dto: CreateDto) {
    return this.subs.create(dto);
  }

  @Get('plans')
  plans() {
    return this.subs.plans();
  }

  @Post('plans')
  createPlan(@Body() dto: PlanDto) {
    return this.subs.createPlan(dto);
  }

  @Put('plans/:id')
  updatePlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlanDto) {
    return this.subs.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  deletePlan(@Param('id', ParseUUIDPipe) id: string) {
    return this.subs.deletePlan(id);
  }

  @HttpCode(200)
  @Post(':id/paid')
  paid(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PaidDto) {
    return this.subs.markPaid(id, dto.paymentMethod);
  }

  @HttpCode(200)
  @Post(':id/remind')
  remind(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.subs.remind(auth, id);
  }

  @HttpCode(200)
  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.subs.cancel(id);
  }

  @RequirePermissions(StaffPermission.CAN_MANAGE_PAYMENTS, StaffPermission.CAN_ARCHIVE_ACCOUNTS)
  @HttpCode(200)
  @Post(':id/archive-child')
  archiveChild(@Param('id', ParseUUIDPipe) id: string) {
    return this.subs.archiveChild(id);
  }
}
