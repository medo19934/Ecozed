import { Module } from '@nestjs/common';
import { AssistantModule } from '../assistant/assistant.module';
import { Transcriber } from './transcriber';
import { WhatsAppClient } from './whatsapp.client';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';

@Module({
  imports: [AssistantModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, WhatsAppClient, Transcriber],
})
export class WhatsAppModule {}
