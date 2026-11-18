import { Module } from '@nestjs/common';
import { BranchesModule } from '../branches/branches.module';
import { ChildrenModule } from '../children/children.module';
import { ClassesModule } from '../classes/classes.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UsersModule } from '../users/users.module';
import { AiPlanner } from './ai-planner';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [BranchesModule, ChildrenModule, ClassesModule, SubscriptionsModule, UsersModule],
  controllers: [AssistantController],
  providers: [AssistantService, AiPlanner],
})
export class AssistantModule {}
