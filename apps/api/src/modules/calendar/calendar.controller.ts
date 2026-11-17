import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  FeatureToggle,
  CalendarEventSchema,
  CalendarQuerySchema,
  StaffPermission,
} from '@latif/shared';
import { createZodDto } from 'nestjs-zod';
import {
  RequireFeature,
  CurrentAuth,
  RequirePermissions,
  type AuthContext,
} from '../../common/decorators/auth.decorators';
import { CalendarService } from './calendar.service';

class EventDto extends createZodDto(CalendarEventSchema) {}
class QueryDto extends createZodDto(CalendarQuerySchema) {}

/** Everyone reads their own scope; admin + manager (canManageCurriculum) add. */
@ApiTags('calendar')
@ApiBearerAuth()
@RequireFeature(FeatureToggle.CALENDAR)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext, @Query() q: QueryDto) {
    return this.calendar.list(auth, q);
  }

  @RequirePermissions(StaffPermission.CAN_MANAGE_CURRICULUM)
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: EventDto) {
    return this.calendar.create(auth, dto);
  }

  @RequirePermissions(StaffPermission.CAN_MANAGE_CURRICULUM)
  @Put(':id')
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EventDto,
  ) {
    return this.calendar.update(auth, id, dto);
  }

  @RequirePermissions(StaffPermission.CAN_MANAGE_CURRICULUM)
  @Delete(':id')
  remove(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.calendar.remove(auth, id);
  }
}
