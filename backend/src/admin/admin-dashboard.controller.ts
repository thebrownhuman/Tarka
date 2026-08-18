import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service';
import { ListCandidatesDto } from './dto/list-candidates.dto';
import { ListAttemptsDto } from './dto/list-attempts.dto';
import { ReleaseResultsDto } from './dto/release-results.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TestAttemptStatus } from '../tests/entities/test-attempt.entity';
import { TestAttemptSummary } from '../tests/test-attempts.repository';

function toAttemptResponse(item: TestAttemptSummary) {
  return {
    id: item.id,
    candidate: {
      id: item.candidate.id,
      login_id: item.candidate.loginId,
      display_name: item.candidate.displayName,
    },
    test: {
      id: item.test.id,
      title: item.test.title,
    },
    status: item.status,
    score: item.score,
    current_question_index: item.currentQuestionIndex,
    started_at: item.startedAt,
    submitted_at: item.submittedAt,
    results_released_at: item.resultsReleasedAt,
  };
}

// JwtAuthGuard, MustChangePasswordGuard, and RolesGuard are registered globally
// (see auth.module.ts APP_GUARD providers) - @Roles() here is all this controller needs.
@Controller('api/v1/admin/dashboard')
@Roles(UserRole.ADMIN)
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @HttpCode(HttpStatus.OK)
  @Post('candidates/list')
  async listCandidates(@Body() dto: ListCandidatesDto) {
    const result = await this.adminDashboardService.listCandidates(dto.offset, dto.limit);

    return {
      items: result.items.map((item) => ({
        id: item.id,
        login_id: item.loginId,
        display_name: item.displayName,
        must_change_password: item.mustChangePassword,
        is_active: item.isActive,
        last_login_at: item.lastLoginAt,
        created_at: item.createdAt,
      })),
      total: result.total,
      offset: result.offset,
      limit: result.limit,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('attempts/list')
  async listAttempts(@Body() dto: ListAttemptsDto) {
    const result = await this.adminDashboardService.listAttempts(
      {
        candidateId: dto.candidate_id,
        testId: dto.test_id,
        status: dto.status as TestAttemptStatus | undefined,
      },
      dto.offset,
      dto.limit,
    );

    return {
      items: result.items.map(toAttemptResponse),
      total: result.total,
      offset: result.offset,
      limit: result.limit,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('attempts/release')
  async releaseResults(@Body() dto: ReleaseResultsDto) {
    const attempt = await this.adminDashboardService.releaseResults(dto.attempt_id);

    return {
      id: attempt.id,
      candidate_id: attempt.candidateId,
      test_id: attempt.testId,
      status: attempt.status,
      score: attempt.score,
      current_question_index: attempt.currentQuestionIndex,
      started_at: attempt.startedAt,
      submitted_at: attempt.submittedAt,
      results_released_at: attempt.resultsReleasedAt,
    };
  }
}
