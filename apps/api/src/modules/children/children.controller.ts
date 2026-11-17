import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ChildListQuerySchema, ChildSchema, StaffPermission } from '@latif/shared';
import { createZodDto } from 'nestjs-zod';
import {
  CurrentAuth,
  RequirePermissions,
  Roles,
  type AuthContext,
} from '../../common/decorators/auth.decorators';
import { fileResponse } from '../../common/utils/files';
import { MAX_UPLOAD_BYTES, type UploadedBlob } from '../storage/storage.service';
import { ChildrenService } from './children.service';

class ChildDto extends createZodDto(ChildSchema) {}
class ChildListQueryDto extends createZodDto(ChildListQuerySchema) {}

/** Staff-side children records. Parents use /parent/children. */
@ApiTags('children')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
@Controller('children')
export class ChildrenController {
  constructor(private readonly children: ChildrenService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext, @Query() q: ChildListQueryDto) {
    return this.children.list(auth, q);
  }

  @Get(':id')
  get(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.children.get(auth, id);
  }

  @RequirePermissions(StaffPermission.CAN_ADD_CHILD)
  @Post()
  create(@Body() dto: ChildDto) {
    return this.children.create(dto);
  }

  @RequirePermissions(StaffPermission.CAN_ADD_CHILD)
  @Put(':id')
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChildDto,
  ) {
    return this.children.update(auth, id, dto);
  }

  @RequirePermissions(StaffPermission.CAN_ARCHIVE_ACCOUNTS)
  @Post(':id/archive')
  archive(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.children.setArchived(auth, id, true);
  }

  @RequirePermissions(StaffPermission.CAN_ARCHIVE_ACCOUNTS)
  @Post(':id/restore')
  restore(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.children.setArchived(auth, id, false);
  }

  @RequirePermissions(StaffPermission.CAN_ADD_CHILD)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @Post(':id/photo')
  setPhoto(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: UploadedBlob,
  ) {
    return this.children.setPhoto(auth, id, file);
  }

  @Get(':id/photo')
  async photo(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    const { buffer, mime } = await this.children.photo(auth, id);
    return fileResponse(buffer, mime, 'photo', true);
  }
}
