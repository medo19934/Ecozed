import { Global, Module } from '@nestjs/common';
import { DemoService } from './demo.service';

@Global()
@Module({ providers: [DemoService], exports: [DemoService] })
export class DemoModule {}
