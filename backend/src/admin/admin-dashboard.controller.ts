import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service';
import { ListCandidatesDto } from './dto/list-candidates.dto';
import { ListAttemptsDto } from './dto/list-attempts.dto';
import { ReleaseResultsDto } from './dto/release-results.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TestAttemptStatus } from '../tests/entities/test-attempt.entity';
import { TestAttemptSummary } from '../tests/test-attempts.repository';
import { AttemptDetailResult, AttemptHistoryService } from '../tests/attempt-history.service';
import { AppException } from '../common/errors/app.exception';
import { AppErrorCode } from '../common/errors/app-error-code';

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
    results_include_answers: item.resultsIncludeAnswers,
  };
}

// JwtAuthGuard, MustChangePasswordGuard, and RolesGuard are registered globally
// (see auth.module.ts APP_GUARD providers) - @Roles() here is all this controller needs.
@Controller('api/v1/admin/dashboard')
@Roles(UserRole.ADMIN)
export class AdminDashboardController {
  constructor(
    private readonly adminDashboardService: AdminDashboardService,
    private readonly attemptHistoryService: AttemptHistoryService,
  ) {}

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
    const attempt = await this.adminDashboardService.releaseResults(dto.attempt_id, dto.include_answers ?? false);

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
      results_include_answers: attempt.resultsIncludeAnswers,
    };
  }

  // Full per-question breakdown for any attempt, regardless of results_released_at -
  // admins need this to decide whether to release results (gap identified in Feature 5).
  @HttpCode(HttpStatus.OK)
  @Get('attempts/detail')
  async attemptDetail(@Query('attempt_id') attemptId?: string) {
    if (!attemptId) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'attempt_id is required', HttpStatus.BAD_REQUEST);
    }

    const result = await this.attemptHistoryService.getAdminAttemptDetail(attemptId);
    return this.toDetailResponse(result);
  }

  private toDetailResponse(result: AttemptDetailResult) {
    return {
      attempt_id: result.attemptId,
      test_id: result.testId,
      test_title: result.testTitle,
      candidate_id: result.candidateId,
      status: result.status,
      score: result.score,
      total_questions: result.totalQuestions,
      submitted_at: result.submittedAt,
      results_released_at: result.resultsReleasedAt,
      results_include_answers: result.resultsIncludeAnswers,
      answers: result.answers.map((answer) => ({
        question_id: answer.questionId,
        position: answer.position,
        question_text: answer.questionText,
        image_url: answer.imageUrl,
        question_type: answer.questionType,
        options: answer.options,
        passage_text: answer.passageText,
        correct_option_ids: answer.correctOptionIds,
        explanation: answer.explanation,
        selected_option_ids: answer.selectedOptionIds,
        is_correct: answer.isCorrect,
        time_spent_seconds: answer.timeSpentSeconds,
        answered_at: answer.answeredAt,
      })),
    };
  }
}
