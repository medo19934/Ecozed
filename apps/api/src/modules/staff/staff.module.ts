import { Module } from '@nestjs/common';
import { ClassesModule } from '../classes/classes.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({ imports: [ClassesModule], controllers: [StaffController], providers: [StaffService] })
export class StaffModule {}
