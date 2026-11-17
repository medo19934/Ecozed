import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  FeatureToggle,
  MessagePageQuerySchema,
  OpenThreadSchema,
  ThreadListQuerySchema,
  type OpenThreadInput,
} from '@latif/shared';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import {
  RequireFeature,
  CurrentAuth,
  Public,
  type AuthContext,
} from '../../common/decorators/auth.decorators';
import { fileResponse } from '../../common/utils/files';
import { MAX_UPLOAD_BYTES, type UploadedBlob } from '../storage/storage.service';
import { MessagesService } from './messages.service';

class ListDto extends createZodDto(ThreadListQuerySchema) {}
class PageDto extends createZodDto(MessagePageQuerySchema) {}

@ApiTags('messages')
@ApiBearerAuth()
@RequireFeature(FeatureToggle.MESSAGES)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  /** Signed, time-limited attachment link (no auth header: for the app's image/audio players). */
  @Public()
  @Get('f/:token')
  async signedFile(@Param('token') token: string) {
    const f = await this.messages.signedAttachment(token.slice(0, 400));
    const inline =
      f.mime.startsWith('image/') || f.mime.startsWith('audio/') || f.mime === 'application/pdf';
    return fileResponse(f.buffer, f.mime, f.name, inline);
  }

  @Get('threads')
  threads(@CurrentAuth() auth: AuthContext, @Query() q: ListDto) {
    return this.messages.threads(auth, q.tab, q.search);
  }

  @Get('unread')
  unread(@CurrentAuth() auth: AuthContext) {
    return this.messages.unreadTotal(auth);
  }

  @Get('contacts')
  contacts(@CurrentAuth() auth: AuthContext) {
    return this.messages.contacts(auth);
  }

  @Post('threads')
  open(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(OpenThreadSchema)) dto: OpenThreadInput,
  ) {
    return this.messages.open(auth, dto);
  }

  @Get('threads/:id')
  list(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: PageDto,
  ) {
    return this.messages.messages(auth, id, q.before);
  }

  /** JSON { body } or multipart with "file" (+ optional "body"). */
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @Post('threads/:id')
  send(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('body') body?: string,
    @UploadedFile() file?: UploadedBlob,
  ) {
    return this.messages.send(
      auth,
      id,
      typeof body === 'string' ? body.slice(0, 4000) : undefined,
      file,
    );
  }

  @Get('threads/:id/files/:messageId')
  async file(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    const f = await this.messages.attachment(auth, id, messageId);
    const inline =
      f.mime.startsWith('image/') || f.mime.startsWith('audio/') || f.mime === 'application/pdf';
    return fileResponse(f.buffer, f.mime, f.name, inline);
  }
}
