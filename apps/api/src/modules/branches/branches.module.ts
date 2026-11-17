import { Module } from '@nestjs/common';
import { BranchesController, BranchListController } from './branches.controller';
import { BranchesService } from './branches.service';

@Module({ controllers: [BranchListController, BranchesController], providers: [BranchesService] })
export class BranchesModule {}
