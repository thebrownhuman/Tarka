import { HttpStatus, Injectable } from '@nestjs/common';
import { TestsRepository } from './tests.repository';
import { QuestionsRepository } from '../questions/questions.repository';
import { TestEntity } from './entities/test.entity';
import { AppException } from '../common/errors/app.exception';
import { AppErrorCode } from '../common/errors/app-error-code';

@Injectable()
export class AdminTestsService {
  constructor(
    private readonly testsRepository: TestsRepository,
    private readonly questionsRepository: QuestionsRepository,
  ) {}

  async createTest(
    title: string,
    durationSeconds: number,
    questionIds: string[],
  ): Promise<{ test: TestEntity; questionCount: number }> {
    // 2-hour hard cap is also enforced by a DB CHECK constraint on test_attempts
    // (base_duration_seconds + extended_seconds <= 7200); this rejects it earlier.
    if (durationSeconds > 7200) {
      throw new AppException(
        AppErrorCode.VALIDATION_ERROR,
        'duration_seconds cannot exceed 7200 (2 hours).',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (questionIds.length === 0) {
      throw new AppException(
        AppErrorCode.VALIDATION_ERROR,
        'question_ids must contain at least one entry.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const uniqueQuestionIds = new Set(questionIds);
    if (uniqueQuestionIds.size !== questionIds.length) {
      throw new AppException(
        AppErrorCode.VALIDATION_ERROR,
        'question_ids must not contain duplicates.',
        HttpStatus.BAD_REQUEST,
      );
    }

    for (const questionId of questionIds) {
      const question = await this.questionsRepository.byId(questionId);
      if (!question) {
        throw new AppException(
          AppErrorCode.QUESTION_NOT_FOUND,
          `question_id "${questionId}" does not reference an existing question.`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    return this.testsRepository.insertWithQuestions({ title, durationSeconds, questionIds });
  }
}
