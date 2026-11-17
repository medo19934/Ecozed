import { Module } from '@nestjs/common';
import { ClassesModule } from '../classes/classes.module';
import { ChildrenController } from './children.controller';
import { ChildrenService } from './children.service';
import { GuardianLinkService } from './guardian-link.service';

@Module({
  imports: [ClassesModule],
  controllers: [ChildrenController],
  providers: [ChildrenService, GuardianLinkService],
  exports: [GuardianLinkService],
})
export class ChildrenModule {}
