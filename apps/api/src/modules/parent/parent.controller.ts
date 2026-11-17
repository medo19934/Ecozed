import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type AuthContext } from '../../common/decorators/auth.decorators';
import { fileResponse } from '../../common/utils/files';
import { ParentService } from './parent.service';

@ApiTags('parent')
@ApiBearerAuth()
@Controller('parent')
export class ParentController {
  constructor(private readonly parent: ParentService) {}

  /** The signed-in user's own linked children (any branch). */
  @Get('children')
  children(@CurrentAuth() auth: AuthContext) {
    return this.parent.children(auth.userId);
  }

  @Get('children/:id/photo')
  async photo(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    const { buffer, mime } = await this.parent.photo(auth.userId, id);
    return fileResponse(buffer, mime, 'photo', true);
  }
}
