import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ChildAttendanceActionSchema,
  FeatureToggle,
  GeoCheckSchema,
  KioskPinSchema,
  KioskScanSchema,
  RosterQuerySchema,
  StaffPermission,
  VacationListQuerySchema,
  VacationRequestSchema,
  VacationReviewSchema,
} from '@latif/shared';
import { createZodDto } from 'nestjs-zod';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import {
  CurrentAuth,
  RequireFeature,
  RequirePermissions,
  Roles,
  type AuthContext,
} from '../../common/decorators/auth.decorators';
import { AttendanceService } from './attendance.service';

class RosterQueryDto extends createZodDto(RosterQuerySchema) {}
class ActionDto extends createZodDto(ChildAttendanceActionSchema) {}
class PinDto extends createZodDto(KioskPinSchema) {}
class ScanDto extends createZodDto(KioskScanSchema) {}
class GeoDto extends createZodDto(GeoCheckSchema) {}
class VacationDtoIn extends createZodDto(VacationRequestSchema) {}
class ReviewDto extends createZodDto(VacationReviewSchema) {}
class VacationQueryDto extends createZodDto(VacationListQuerySchema) {}
class DateQueryDto extends createZodDto(z.object({ date: z.iso.date().optional() })) {}

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  /** Signed-in user's own day (staff record, linked children, PIN status). */
  @Get('me')
  me(@CurrentAuth() auth: AuthContext) {
    return this.attendance.me(auth);
  }

  @Post('me/pin')
  pin(@CurrentAuth() auth: AuthContext) {
    return this.attendance.regeneratePin(auth);
  }

  @Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
  @Get('children')
  roster(@CurrentAuth() auth: AuthContext, @Query() q: RosterQueryDto) {
    return this.attendance.roster(auth, q);
  }

  @Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
  @RequirePermissions(StaffPermission.CAN_MANAGE_ATTENDANCE)
  @HttpCode(200)
  @Post('children/:childId')
  act(
    @CurrentAuth() auth: AuthContext,
    @Param('childId', ParseUUIDPipe) childId: string,
    @Body() dto: ActionDto,
  ) {
    return this.attendance.actOnChild(auth, childId, dto);
  }

  @Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
  @RequirePermissions(StaffPermission.CAN_MANAGE_ATTENDANCE)
  @Get('staff')
  staff(@CurrentAuth() auth: AuthContext, @Query() q: DateQueryDto) {
    return this.attendance.staffDay(auth, q.date);
  }

  // ---- Kiosk (runs on a tablet under a staff session of the branch) ----

  @Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
  @RequirePermissions(StaffPermission.CAN_MANAGE_ATTENDANCE)
  @RequireFeature(FeatureToggle.CHILD_QR_ATTENDANCE)
  @Get('kiosk/token')
  token(@CurrentAuth() auth: AuthContext) {
    return this.attendance.kioskToken(auth);
  }

  @Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
  @RequirePermissions(StaffPermission.CAN_MANAGE_ATTENDANCE)
  @RequireFeature(FeatureToggle.CHILD_QR_ATTENDANCE)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('kiosk/pin')
  kioskPin(@CurrentAuth() auth: AuthContext, @Body() dto: PinDto) {
    return this.attendance.kioskPin(auth, dto.pin);
  }

  /** Any staff member or parent of the token's branch, from the mobile app. */
  @HttpCode(200)
  @Post('kiosk/scan')
  scan(@CurrentAuth() auth: AuthContext, @Body() dto: ScanDto) {
    return this.attendance.kioskScan(auth, dto.token, dto.childIds);
  }

  @HttpCode(200)
  @Post('geo')
  geo(@CurrentAuth() auth: AuthContext, @Body() dto: GeoDto) {
    return this.attendance.geoCheck(auth, dto);
  }

  // ---- Vacations ----

  @Post('vacations')
  requestVacation(@CurrentAuth() auth: AuthContext, @Body() dto: VacationDtoIn) {
    return this.attendance.requestVacation(auth, dto);
  }

  @Get('vacations/mine')
  myVacations(@CurrentAuth() auth: AuthContext) {
    return this.attendance.myVacations(auth);
  }

  @Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
  @Get('vacations')
  vacations(@CurrentAuth() auth: AuthContext, @Query() q: VacationQueryDto) {
    return this.attendance.listVacations(auth, q.status);
  }

  @Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
  @RequirePermissions(StaffPermission.CAN_MANAGE_ATTENDANCE)
  @HttpCode(200)
  @Post('vacations/:id/review')
  review(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDto,
  ) {
    return this.attendance.reviewVacation(auth, id, dto);
  }
}
