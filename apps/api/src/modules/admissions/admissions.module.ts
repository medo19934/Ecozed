import { Module } from '@nestjs/common';
import { ChildrenModule } from '../children/children.module';
import { ClassesModule } from '../classes/classes.module';
import { AdmissionsController } from './admissions.controller';
import { AdmissionsService } from './admissions.service';

@Module({
  imports: [ClassesModule, ChildrenModule],
  controllers: [AdmissionsController],
  providers: [AdmissionsService],
})
export class AdmissionsModule {}
