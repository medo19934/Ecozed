import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ChildLinkSchema,
  CreateUserSchema,
  MoveChildSchema,
  PaginationQuerySchema,
  UpdateUserSchema,
  UserListQuerySchema,
} from '@latif/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentAuth, Roles, type AuthContext } from '../../common/decorators/auth.decorators';
import { UsersService } from './users.service';

class CreateDto extends createZodDto(CreateUserSchema) {}
class UpdateDto extends createZodDto(UpdateUserSchema) {}
class ListDto extends createZodDto(UserListQuerySchema) {}
class LinkDto extends createZodDto(ChildLinkSchema) {}
class MoveDto extends createZodDto(MoveChildSchema) {}
class PageDto extends createZodDto(PaginationQuerySchema) {}

/** Settings > Users: general admins (everyone) and branch managers (own teachers and parents). */
@ApiTags('users')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'MANAGER')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext, @Query() q: ListDto) {
    return this.users.list(auth, q);
  }

  /** Audit trail of user management (general admin only). */
  @Roles('SUPER_ADMIN')
  @Get('audit')
  audit(@Query() q: PageDto) {
    return this.users.auditTrail(q.page, q.pageSize);
  }

  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: CreateDto) {
    return this.users.create(auth, dto);
  }

  @HttpCode(200)
  @Post('children/:childId/move')
  move(
    @CurrentAuth() auth: AuthContext,
    @Param('childId', ParseUUIDPipe) childId: string,
    @Body() dto: MoveDto,
  ) {
    return this.users.moveChild(auth, childId, dto);
  }

  @Get(':id')
  get(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(auth, id);
  }

  @Patch(':id')
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDto,
  ) {
    return this.users.update(auth, id, dto);
  }

  @HttpCode(200)
  @Post(':id/deactivate')
  deactivate(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.setActive(auth, id, false);
  }

  @HttpCode(200)
  @Post(':id/reactivate')
  reactivate(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.setActive(auth, id, true);
  }

  @Delete(':id')
  remove(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.remove(auth, id);
  }

  @HttpCode(200)
  @Post(':id/password')
  resetPassword(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.resetPassword(auth, id);
  }

  @HttpCode(200)
  @Post(':id/children')
  link(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkDto,
  ) {
    return this.users.linkChild(auth, id, dto.childId, dto.relationship);
  }

  @Delete(':id/children/:childId')
  unlink(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('childId', ParseUUIDPipe) childId: string,
  ) {
    return this.users.unlinkChild(auth, id, childId);
  }
}
