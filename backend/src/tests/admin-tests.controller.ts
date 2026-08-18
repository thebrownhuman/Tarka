import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AdminTestsService } from './admin-tests.service';
import { CreateTestDto } from './dto/create-test.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

// JwtAuthGuard, MustChangePasswordGuard, and RolesGuard are registered globally
// (see auth.module.ts APP_GUARD providers) - @Roles() here is all this controller needs.
@Controller('api/v1/admin/tests')
@Roles(UserRole.ADMIN)
export class AdminTestsController {
  constructor(private readonly adminTestsService: AdminTestsService) {}

  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async create(@Body() dto: CreateTestDto) {
    const { test, questionCount } = await this.adminTestsService.createTest(
      dto.title,
      dto.duration_seconds,
      dto.question_ids,
    );

    return {
      id: test.id,
      title: test.title,
      duration_seconds: test.durationSeconds,
      question_count: questionCount,
      created_at: test.createdAt,
    };
  }
}
