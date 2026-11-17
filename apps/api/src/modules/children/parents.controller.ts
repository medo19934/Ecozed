import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AddParentSchema, StaffPermission } from '@latif/shared';
import { createZodDto } from 'nestjs-zod';
import {
  CurrentAuth,
  RequirePermissions,
  Roles,
  type AuthContext,
} from '../../common/decorators/auth.decorators';
import { ChildrenService } from './children.service';

class AddParentDto extends createZodDto(AddParentSchema) {}

/** Parents of the branch (teachers: of their classes). Adding one links them to children by email/phone. */
@ApiTags('children')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
@Controller('parents')
export class ParentsController {
  constructor(private readonly children: ChildrenService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext, @Query('search') search?: string) {
    return this.children.parents(auth, search?.trim().slice(0, 100) || undefined);
  }

  @RequirePermissions(StaffPermission.CAN_ADD_CHILD)
  @Post()
  add(@CurrentAuth() auth: AuthContext, @Body() dto: AddParentDto) {
    return this.children.addParent(auth, dto);
  }
}
