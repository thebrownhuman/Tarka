import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { QuestionView, TestAttemptService } from './test-attempt.service';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { GotoQuestionDto } from './dto/goto-question.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { AttemptIdDto } from './dto/attempt-id.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AppException } from '../common/errors/app.exception';
import { AppErrorCode } from '../common/errors/app-error-code';

// JwtAuthGuard, MustChangePasswordGuard, and RolesGuard are registered globally
// (see auth.module.ts APP_GUARD providers) - @Roles() here is all this controller needs.
@Controller('api/v1/test-attempts')
@Roles(UserRole.CANDIDATE)
export class TestAttemptsController {
  constructor(private readonly testAttemptService: TestAttemptService) {}

  @HttpCode(HttpStatus.OK)
  @Post('start')
  async start(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartAttemptDto) {
    const result = await this.testAttemptService.startAttempt(dto.test_id, user.id);
    return {
      attempt_id: result.attemptId,
      remaining_seconds: result.remainingSeconds,
      current_question_index: result.currentQuestionIndex,
      total_questions: result.totalQuestions,
      status: result.status,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Get('current-question')
  async currentQuestion(@CurrentUser() user: AuthenticatedUser, @Query('attempt_id') attemptId?: string) {
    if (!attemptId) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'attempt_id is required', HttpStatus.BAD_REQUEST);
    }

    const result = await this.testAttemptService.getCurrentQuestion(attemptId, user.id);
    return this.toQuestionResponse(result);
  }

  @HttpCode(HttpStatus.OK)
  @Post('question')
  async question(@CurrentUser() user: AuthenticatedUser, @Body() dto: GotoQuestionDto) {
    const result = await this.testAttemptService.getQuestionAt(dto.attempt_id, user.id, dto.position);
    return this.toQuestionResponse(result);
  }

  @HttpCode(HttpStatus.OK)
  @Post('answer')
  async answer(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitAnswerDto) {
    await this.testAttemptService.submitAnswer(dto.attempt_id, user.id, dto.question_id, dto.selected_option_ids);
    return { success: true };
  }

  @HttpCode(HttpStatus.OK)
  @Post('next')
  async next(@CurrentUser() user: AuthenticatedUser, @Body() dto: AttemptIdDto) {
    const result = await this.testAttemptService.advanceToNextQuestion(dto.attempt_id, user.id);
    return { current_question_index: result.currentQuestionIndex, completed: result.completed };
  }

  @HttpCode(HttpStatus.OK)
  @Post('submit')
  async submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: AttemptIdDto) {
    const result = await this.testAttemptService.submitTest(dto.attempt_id, user.id);
    return { score: result.score, total_questions: result.totalQuestions };
  }

  private toQuestionResponse(result: QuestionView) {
    return {
      id: result.question.id,
      question_text: result.question.questionText,
      image_url: result.question.imageUrl,
      options: result.question.options,
      question_type: result.question.questionType,
      selected_option_ids: result.question.selectedOptionIds,
      remaining_seconds: result.remainingSeconds,
    };
  }
}
