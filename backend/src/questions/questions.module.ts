import { Module } from '@nestjs/common';
import { AdminQuestionsController } from './admin-questions.controller';
import { QuestionBankService } from './question-bank.service';
import { QuestionsRepository } from './questions.repository';
import { PassagesRepository } from './passages.repository';

@Module({
  controllers: [AdminQuestionsController],
  providers: [QuestionBankService, QuestionsRepository, PassagesRepository],
  exports: [QuestionsRepository, PassagesRepository],
})
export class QuestionsModule {}
