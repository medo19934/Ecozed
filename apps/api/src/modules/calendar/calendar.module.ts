import { Module } from '@nestjs/common';
import { ClassesModule } from '../classes/classes.module';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  imports: [ClassesModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
