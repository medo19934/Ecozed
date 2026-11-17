import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { StaffPermission, UpdateBranchSchema, UpdateFeaturesSchema } from '@latif/shared';
import { createZodDto } from 'nestjs-zod';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { fileResponse } from '../../common/utils/files';
import { MAX_UPLOAD_BYTES, type UploadedBlob } from '../storage/storage.service';
import { BranchesService } from './branches.service';

class UpdateBranchDto extends createZodDto(UpdateBranchSchema) {}
class UpdateFeaturesDto extends createZodDto(UpdateFeaturesSchema) {}

/** Branch list for pickers (e.g. parents choosing where to enroll). */
@ApiTags('branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchListController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  list() {
    return this.branches.list();
  }
}

@ApiTags('branches')
@ApiBearerAuth()
@Controller('branches/current')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  current() {
    return this.branches.current();
  }

  @RequirePermissions(StaffPermission.CAN_MANAGE_SETTINGS)
  @Patch()
  update(@Body() dto: UpdateBranchDto) {
    return this.branches.update(dto);
  }

  @RequirePermissions(StaffPermission.CAN_MANAGE_SETTINGS)
  @Put('features')
  features(@Body() dto: UpdateFeaturesDto) {
    return this.branches.updateFeatures(dto);
  }

  @RequirePermissions(StaffPermission.CAN_MANAGE_SETTINGS)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @Post('logo')
  setLogo(@UploadedFile() file?: UploadedBlob) {
    return this.branches.setLogo(file);
  }

  @RequirePermissions(StaffPermission.CAN_MANAGE_SETTINGS)
  @Delete('logo')
  removeLogo() {
    return this.branches.removeLogo();
  }

  @Get('logo')
  async logo() {
    const { buffer, mime } = await this.branches.logo();
    return fileResponse(buffer, mime, 'logo', true);
  }
}
