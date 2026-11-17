import { Body, Controller, Get, HttpCode, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FeatureToggle, DailyReportSchema } from '@latif/shared';
import { createZodDto } from 'nestjs-zod';
import {
  RequireFeature,
  CurrentAuth,
  Roles,
  type AuthContext,
} from '../../common/decorators/auth.decorators';
import { DailyReportsService } from './daily-reports.service';

class ReportDto extends createZodDto(DailyReportSchema) {}

@ApiTags('daily-reports')
@ApiBearerAuth()
@RequireFeature(FeatureToggle.DAILY_REPORTS)
@Controller('daily-reports')
export class DailyReportsController {
  constructor(private readonly reports: DailyReportsService) {}

  /** Parent: shared reports of own children. */
  @Get('mine')
  mine(@CurrentAuth() auth: AuthContext) {
    return this.reports.mine(auth.userId);
  }

  /** Staff: the day's roster with reports (teachers: own classes). */
  @Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
  @Get()
  day(
    @CurrentAuth() auth: AuthContext,
    @Query('date') date?: string,
    @Query('classroomId') classroomId?: string,
  ) {
    const d = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
    const c = classroomId && /^[0-9a-f-]{36}$/i.test(classroomId) ? classroomId : undefined;
    return this.reports.day(auth, d, c);
  }

  @Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
  @HttpCode(200)
  @Put()
  save(@CurrentAuth() auth: AuthContext, @Body() dto: ReportDto) {
    return this.reports.save(auth, dto);
  }
}
