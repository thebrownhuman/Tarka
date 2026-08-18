import { Module } from '@nestjs/common';
import { TestsRepository } from './tests.repository';
import { TestAttemptsRepository } from './test-attempts.repository';
import { TestAttemptAnswersRepository } from './test-attempt-answers.repository';
import { TestAttemptService } from './test-attempt.service';
import { TestAttemptsController } from './test-attempts.controller';
import { AdminTestsController } from './admin-tests.controller';
import { AdminTestsService } from './admin-tests.service';
import { QuestionsModule } from '../questions/questions.module';

@Module({
  imports: [QuestionsModule],
  controllers: [TestAttemptsController, AdminTestsController],
  providers: [
    TestsRepository,
    TestAttemptsRepository,
    TestAttemptAnswersRepository,
    TestAttemptService,
    AdminTestsService,
  ],
  exports: [TestsRepository, TestAttemptsRepository, TestAttemptAnswersRepository],
})
export class TestsModule {}
