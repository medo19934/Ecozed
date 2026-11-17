import { Module } from '@nestjs/common';
import { BranchesController, BranchListController } from './branches.controller';
import { BranchBootstrapService } from './branch-bootstrap.service';
import { BranchesService } from './branches.service';

@Module({
  controllers: [BranchListController, BranchesController],
  providers: [BranchesService, BranchBootstrapService],
})
export class BranchesModule {}
