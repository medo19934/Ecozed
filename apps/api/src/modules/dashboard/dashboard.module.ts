import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { UnitsModule } from '../units/units.module';
import { DashboardController } from './dashboard.controller';

@Module({ imports: [AttendanceModule, UnitsModule], controllers: [DashboardController] })
export class DashboardModule {}
