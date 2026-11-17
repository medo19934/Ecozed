import { Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { TestDataService } from './test-data.service';

/** Admin-only TEST data button (super admin + branch manager). */
@ApiTags('test-data')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'MANAGER')
@Controller('test-data')
export class TestDataController {
  constructor(private readonly testData: TestDataService) {}

  @Get()
  status() {
    return this.testData.status();
  }

  @Post()
  create() {
    return this.testData.create();
  }

  @Delete()
  clear() {
    return this.testData.clear();
  }
}
