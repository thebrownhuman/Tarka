import { HttpStatus, Injectable } from '@nestjs/common';
import { PassagesRepository } from './passages.repository';
import { CreateQuestionParams, QuestionListFilters, QuestionsRepository } from './questions.repository';
import { QuestionDifficulty, QuestionEntity, QuestionType } from './entities/question.entity';
import { UploadQuestionDto } from './dto/upload-questions.dto';
import { AppException } from '../common/errors/app.exception';
import { AppErrorCode } from '../common/errors/app-error-code';

@Injectable()
export class QuestionBankService {
  constructor(
    private readonly questionsRepository: QuestionsRepository,
    private readonly passagesRepository: PassagesRepository,
  ) {}

  async uploadQuestions(questions: UploadQuestionDto[]): Promise<{ inserted: number }> {
    const validationErrors: string[] = [];

    questions.forEach((question, index) => {
      const optionIds = new Set(question.options.map((option) => option.id));

      if (optionIds.size !== question.options.length) {
        validationErrors.push(`Question at index ${index}: options contain duplicate ids.`);
      }

      const unknownCorrectIds = question.correct_option_ids.filter((id) => !optionIds.has(id));
      if (unknownCorrectIds.length > 0) {
        validationErrors.push(
          `Question at index ${index}: correct_option_ids [${unknownCorrectIds.join(', ')}] do not match any option id.`,
        );
      }

      if (question.question_type === QuestionType.SINGLE_CHOICE && question.correct_option_ids.length !== 1) {
        validationErrors.push(
          `Question at index ${index}: single_choice questions must have exactly 1 correct_option_id, got ${question.correct_option_ids.length}.`,
        );
      }

      if (question.question_type === QuestionType.MULTI_CHOICE && question.correct_option_ids.length < 1) {
        validationErrors.push(`Question at index ${index}: multi_choice questions must have at least 1 correct_option_id.`);
      }

      if (question.passage_id && question.passage_text) {
        validationErrors.push(
          `Question at index ${index}: provide either passage_id or passage_text, not both.`,
        );
      }
    });

    if (validationErrors.length > 0) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, validationErrors.join(' '), HttpStatus.BAD_REQUEST);
    }

    const paramsList: CreateQuestionParams[] = [];
    for (let index = 0; index < questions.length; index += 1) {
      const question = questions[index];
      let passageId: string | null = null;

      if (question.passage_id) {
        const passage = await this.passagesRepository.byId(question.passage_id);
        if (!passage) {
          throw new AppException(
            AppErrorCode.VALIDATION_ERROR,
            `Question at index ${index}: passage_id "${question.passage_id}" does not exist.`,
            HttpStatus.BAD_REQUEST,
          );
        }
        passageId = passage.id;
      } else if (question.passage_text) {
        const passage = await this.passagesRepository.insert(question.passage_text);
        passageId = passage.id;
      }

      paramsList.push({
        domain: question.domain,
        topic: question.topic,
        subpattern: question.subpattern ?? null,
        difficulty: question.difficulty as QuestionDifficulty,
        questionType: question.question_type as QuestionType,
        passageId,
        questionText: question.question_text,
        imageUrl: question.image_url ?? null,
        options: question.options,
        correctOptionIds: question.correct_option_ids,
        explanation: question.explanation,
      });
    }

    const inserted = await this.questionsRepository.bulkInsert(paramsList);
    return { inserted: inserted.length };
  }

  async listQuestions(
    filters: QuestionListFilters,
    offset: number,
    limit: number,
  ): Promise<{ items: QuestionEntity[]; total: number; offset: number; limit: number }> {
    const { items, total } = await this.questionsRepository.list(filters, offset, limit);
    return { items, total, offset, limit };
  }
}
