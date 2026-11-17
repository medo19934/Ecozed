import { Module } from '@nestjs/common';
import { ChildrenModule } from '../children/children.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({ imports: [ChildrenModule], controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
