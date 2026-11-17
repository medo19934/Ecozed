import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AcceptAdmissionSchema,
  AdmissionListQuerySchema,
  CreateAdmissionSchema,
  RejectAdmissionSchema,
  StaffPermission,
} from '@latif/shared';
import { createZodDto } from 'nestjs-zod';
import {
  CurrentAuth,
  RequirePermissions,
  Roles,
  type AuthContext,
} from '../../common/decorators/auth.decorators';
import { AdmissionsService } from './admissions.service';

class CreateDto extends createZodDto(CreateAdmissionSchema) {}
class ListDto extends createZodDto(AdmissionListQuerySchema) {}
class AcceptDto extends createZodDto(AcceptAdmissionSchema) {}
class RejectDto extends createZodDto(RejectAdmissionSchema) {}

@ApiTags('admissions')
@ApiBearerAuth()
@Controller('admissions')
export class AdmissionsController {
  constructor(private readonly admissions: AdmissionsService) {}

  /** Parent: "Enroll my child". */
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: CreateDto) {
    return this.admissions.create(auth, dto);
  }

  @Get('mine')
  mine(@CurrentAuth() auth: AuthContext) {
    return this.admissions.mine(auth);
  }

  @Delete('mine/:id')
  withdraw(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.admissions.withdraw(auth, id);
  }

  /** Admin + branch manager (and staff granted canManageEnrollment), own branch. */
  @Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
  @RequirePermissions(StaffPermission.CAN_MANAGE_ENROLLMENT)
  @Get()
  list(@Query() q: ListDto) {
    return this.admissions.list(q);
  }

  @Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
  @RequirePermissions(StaffPermission.CAN_MANAGE_ENROLLMENT, StaffPermission.CAN_ADD_CHILD)
  @HttpCode(200)
  @Post(':id/accept')
  accept(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptDto,
  ) {
    return this.admissions.accept(auth, id, dto);
  }

  @Roles('SUPER_ADMIN', 'MANAGER', 'STAFF')
  @RequirePermissions(StaffPermission.CAN_MANAGE_ENROLLMENT)
  @HttpCode(200)
  @Post(':id/reject')
  reject(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectDto,
  ) {
    return this.admissions.reject(auth, id, dto.reason);
  }
}
