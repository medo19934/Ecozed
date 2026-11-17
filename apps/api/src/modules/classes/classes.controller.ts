import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClassroomSchema, StaffPermission } from '@latif/shared';
import { createZodDto } from 'nestjs-zod';
import {
  CurrentAuth,
  RequirePermissions,
  Roles,
  type AuthContext,
} from '../../common/decorators/auth.decorators';
import { ClassesService } from './classes.service';

class ClassroomDtoIn extends createZodDto(ClassroomSchema) {}

@ApiTags('classes')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
@Controller('classes')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.classes.list(auth);
  }

  @RequirePermissions(StaffPermission.CAN_MANAGE_CLASSES)
  @Post()
  create(@Body() dto: ClassroomDtoIn) {
    return this.classes.create(dto);
  }

  @RequirePermissions(StaffPermission.CAN_MANAGE_CLASSES)
  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ClassroomDtoIn) {
    return this.classes.update(id, dto);
  }

  @RequirePermissions(StaffPermission.CAN_MANAGE_CLASSES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.classes.remove(id);
  }
}
