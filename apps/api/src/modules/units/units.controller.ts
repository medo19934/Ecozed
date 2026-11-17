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
  StaffPermission,
  UnitItemSchema,
  UnitListQuerySchema,
  UnitSchema,
} from '@latif/shared';
import { createZodDto } from 'nestjs-zod';
import { RequireFeature, RequirePermissions, Roles } from '../../common/decorators/auth.decorators';
import { UnitsService } from './units.service';

class UnitDtoIn extends createZodDto(UnitSchema) {}
class ItemDto extends createZodDto(UnitItemSchema) {}
class ListDto extends createZodDto(UnitListQuerySchema) {}

/** Admin + branch manager edit; teachers read. */
@ApiTags('units')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
@RequireFeature(FeatureToggle.UNITS)
@Controller('units')
export class UnitsController {
  constructor(private readonly units: UnitsService) {}

  @Get()
  list(@Query() q: ListDto) {
    return this.units.list(q.status, q.search);
  }

  @RequirePermissions(StaffPermission.CAN_MANAGE_CURRICULUM)
  @Post()
  create(@Body() dto: UnitDtoIn) {
    return this.units.create(dto);
  }

  @RequirePermissions(StaffPermission.CAN_MANAGE_CURRICULUM)
  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UnitDtoIn) {
    return this.units.update(id, dto);
  }

  @RequirePermissions(StaffPermission.CAN_MANAGE_CURRICULUM)
  @Post(':id/archive')
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.units.setArchived(id, true);
  }

  @RequirePermissions(StaffPermission.CAN_MANAGE_CURRICULUM)
  @Post(':id/restore')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.units.setArchived(id, false);
  }

  @RequirePermissions(StaffPermission.CAN_MANAGE_CURRICULUM)
  @Post(':id/items')
  addItem(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ItemDto) {
    return this.units.addItem(id, dto);
  }

  @RequirePermissions(StaffPermission.CAN_MANAGE_CURRICULUM)
  @Put(':id/items/:itemId')
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: ItemDto,
  ) {
    return this.units.updateItem(id, itemId, dto);
  }

  @RequirePermissions(StaffPermission.CAN_MANAGE_CURRICULUM)
  @Delete(':id/items/:itemId')
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.units.removeItem(id, itemId);
  }
}
