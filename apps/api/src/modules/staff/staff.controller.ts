import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  CreateStaffSchema,
  DocumentListQuerySchema,
  StaffListQuerySchema,
  StaffPermission,
  UpdateStaffSchema,
} from '@latif/shared';
import { createZodDto } from 'nestjs-zod';
import {
  CurrentAuth,
  RequirePermissions,
  Roles,
  type AuthContext,
} from '../../common/decorators/auth.decorators';
import { fileResponse } from '../../common/utils/files';
import { DocumentsService } from '../documents/documents.service';
import { MAX_UPLOAD_BYTES, type UploadedBlob } from '../storage/storage.service';
import { StaffService } from './staff.service';

class CreateStaffDto extends createZodDto(CreateStaffSchema) {}
class UpdateStaffDto extends createZodDto(UpdateStaffSchema) {}
class StaffListQueryDto extends createZodDto(StaffListQuerySchema) {}
class DocumentListQueryDto extends createZodDto(DocumentListQuerySchema) {}

/** Admin + branch manager (and staff explicitly granted canAddStaff). */
@ApiTags('staff')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
@RequirePermissions(StaffPermission.CAN_ADD_STAFF)
@Controller('staff')
export class StaffController {
  constructor(
    private readonly staff: StaffService,
    private readonly documents: DocumentsService,
  ) {}

  @Get()
  list(@Query() q: StaffListQueryDto) {
    return this.staff.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.staff.get(id);
  }

  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: CreateStaffDto) {
    return this.staff.create(auth, dto);
  }

  @Patch(':id')
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staff.update(auth, id, dto);
  }

  @RequirePermissions(StaffPermission.CAN_ADD_STAFF, StaffPermission.CAN_ARCHIVE_ACCOUNTS)
  /** Creates or resets the staff member's login: returns a one-time password to hand over. */
  @Post(':id/password')
  issuePassword(@Param('id', ParseUUIDPipe) id: string) {
    return this.staff.issuePassword(id);
  }

  @Post(':id/archive')
  archive(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.staff.setArchived(auth, id, true);
  }

  @RequirePermissions(StaffPermission.CAN_ADD_STAFF, StaffPermission.CAN_ARCHIVE_ACCOUNTS)
  @Post(':id/restore')
  restore(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.staff.setArchived(auth, id, false);
  }

  // ---- Files (private) ----

  @Get(':id/files')
  async files(@Param('id', ParseUUIDPipe) id: string, @Query() q: DocumentListQueryDto) {
    await this.staff.assertExists(id);
    return this.documents.list('STAFF', id, q.deleted);
  }

  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @Post(':id/files')
  async upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: UploadedBlob,
    @Body('category') category?: string,
  ) {
    await this.staff.assertExists(id);
    return this.documents.upload('STAFF', id, file, category);
  }

  @Get(':id/files/:fileId')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    const { doc, buffer } = await this.documents.download('STAFF', id, fileId);
    return fileResponse(buffer, doc.mimeType, doc.name);
  }

  @Delete(':id/files/:fileId')
  remove(@Param('id', ParseUUIDPipe) id: string, @Param('fileId', ParseUUIDPipe) fileId: string) {
    return this.documents.softDelete('STAFF', id, fileId);
  }

  @Post(':id/files/:fileId/restore')
  restoreFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    return this.documents.restore('STAFF', id, fileId);
  }
}
