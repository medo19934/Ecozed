import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AssistantApplySchema, AssistantPlanRequestSchema } from '@latif/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentAuth, Roles, type AuthContext } from '../../common/decorators/auth.decorators';
import { AiPlanner } from './ai-planner';
import { AssistantService } from './assistant.service';

class PlanDto extends createZodDto(AssistantPlanRequestSchema) {}
class ApplyDto extends createZodDto(AssistantApplySchema) {}

/** Smart assistant (general admins and branch managers). */
@ApiTags('assistant')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'MANAGER')
@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly ai: AiPlanner,
  ) {}

  @Get('status')
  status() {
    return { aiEnabled: this.ai.enabled };
  }

  /** Reads text / CSV and proposes changes. Saves nothing. */
  @HttpCode(200)
  @Post('plan')
  plan(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: PlanDto,
    @Headers('accept-language') lang?: string,
  ) {
    return this.assistant.plan(auth, dto, dto.locale ?? (lang?.startsWith('en') ? 'en' : 'ar'));
  }

  /** Applies the confirmed changes through the regular services. */
  @HttpCode(200)
  @Post('apply')
  apply(@CurrentAuth() auth: AuthContext, @Body() dto: ApplyDto) {
    return this.assistant.apply(auth, dto.operations);
  }
}
