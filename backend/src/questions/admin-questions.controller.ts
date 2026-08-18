import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { QuestionBankService } from './question-bank.service';
import { UploadQuestionsDto } from './dto/upload-questions.dto';
import { ListQuestionsDto } from './dto/list-questions.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { QuestionDifficulty } from './entities/question.entity';

// JwtAuthGuard, MustChangePasswordGuard, and RolesGuard are registered globally
// (see auth.module.ts APP_GUARD providers) - @Roles() here is all this controller needs.
@Controller('api/v1/admin/questions')
@Roles(UserRole.ADMIN)
export class AdminQuestionsController {
  constructor(private readonly questionBankService: QuestionBankService) {}

  @HttpCode(HttpStatus.CREATED)
  @Post('upload')
  async upload(@Body() dto: UploadQuestionsDto) {
    return this.questionBankService.uploadQuestions(dto.questions);
  }

  @HttpCode(HttpStatus.OK)
  @Post('list')
  async list(@Body() dto: ListQuestionsDto) {
    const result = await this.questionBankService.listQuestions(
      {
        domain: dto.domain,
        topic: dto.topic,
        difficulty: dto.difficulty as QuestionDifficulty | undefined,
      },
      dto.offset,
      dto.limit,
    );

    return {
      items: result.items.map((question) => ({
        id: question.id,
        domain: question.domain,
        topic: question.topic,
        subpattern: question.subpattern,
        difficulty: question.difficulty,
        question_type: question.questionType,
        passage_id: question.passageId,
        question_text: question.questionText,
        image_url: question.imageUrl,
        options: question.options,
        correct_option_ids: question.correctOptionIds,
        explanation: question.explanation,
        created_at: question.createdAt,
        updated_at: question.updatedAt,
      })),
      total: result.total,
      offset: result.offset,
      limit: result.limit,
    };
  }
}
