import { HttpStatus, Injectable } from '@nestjs/common';
import { TestsRepository } from './tests.repository';
import { TestAttemptsRepository } from './test-attempts.repository';
import { TestAttemptAnswersRepository } from './test-attempt-answers.repository';
import { QuestionsRepository } from '../questions/questions.repository';
import { TestAttemptEntity, TestAttemptStatus } from './entities/test-attempt.entity';
import { QuestionOption, QuestionType } from '../questions/entities/question.entity';
import { AppException } from '../common/errors/app.exception';
import { AppErrorCode } from '../common/errors/app-error-code';

export interface QuestionForCandidate {
  id: string;
  questionText: string;
  imageUrl: string | null;
  options: QuestionOption[];
  questionType: QuestionType;
  selectedOptionIds: string[] | null;
}

export interface QuestionView {
  question: QuestionForCandidate;
  remainingSeconds: number;
}

export interface AttemptStatusView {
  attemptId: string;
  remainingSeconds: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  status: TestAttemptStatus;
}

@Injectable()
export class TestAttemptService {
  constructor(
    private readonly testsRepository: TestsRepository,
    private readonly testAttemptsRepository: TestAttemptsRepository,
    private readonly testAttemptAnswersRepository: TestAttemptAnswersRepository,
    private readonly questionsRepository: QuestionsRepository,
  ) {}

  /** Server-authoritative remaining time. Always derived from the stored
   * started_at timestamp and the server clock - never trusts a client-supplied
   * "seconds remaining" value, so a closed tab / lost connection simply
   * resumes correctly whenever the candidate comes back. */
  computeRemainingSeconds(attempt: TestAttemptEntity): number {
    const totalAllowedSeconds = attempt.baseDurationSeconds + attempt.extendedSeconds;
    const elapsedSeconds = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);
    return Math.max(0, totalAllowedSeconds - elapsedSeconds);
  }

  async startAttempt(testId: string, candidateId: string): Promise<AttemptStatusView> {
    const test = await this.testsRepository.byId(testId);
    if (!test) {
      throw new AppException(AppErrorCode.TEST_NOT_FOUND, 'Test not found.', HttpStatus.NOT_FOUND);
    }

    const totalQuestions = await this.testsRepository.countQuestions(testId);
    const existing = await this.testAttemptsRepository.activeAttemptForCandidate(testId, candidateId);

    if (existing) {
      const attempt = await this.guardActive(existing);
      return this.toStatusView(attempt, totalQuestions);
    }

    const attempt = await this.testAttemptsRepository.insert({
      testId,
      candidateId,
      baseDurationSeconds: test.durationSeconds,
    });

    return this.toStatusView(attempt, totalQuestions);
  }

  async getCurrentQuestion(attemptId: string, candidateId: string): Promise<QuestionView> {
    const attempt = await this.guardActive(await this.getOwnedAttempt(attemptId, candidateId));
    const question = await this.serveQuestionAtPosition(attempt, attempt.currentQuestionIndex);
    return { question, remainingSeconds: this.computeRemainingSeconds(attempt) };
  }

  /** Revisiting a past question - only ever allowed at or behind the furthest
   * position the candidate has reached, never ahead of it. */
  async getQuestionAt(attemptId: string, candidateId: string, position: number): Promise<QuestionView> {
    const attempt = await this.guardActive(await this.getOwnedAttempt(attemptId, candidateId));

    if (position < 0 || position > attempt.currentQuestionIndex) {
      throw new AppException(
        AppErrorCode.QUESTION_NOT_REACHED_YET,
        'You cannot navigate to a question you have not reached yet.',
        HttpStatus.FORBIDDEN,
      );
    }

    const question = await this.serveQuestionAtPosition(attempt, position);
    return { question, remainingSeconds: this.computeRemainingSeconds(attempt) };
  }

  async submitAnswer(
    attemptId: string,
    candidateId: string,
    questionId: string,
    selectedOptionIds: string[],
  ): Promise<void> {
    const attempt = await this.guardActive(await this.getOwnedAttempt(attemptId, candidateId));

    const position = await this.testsRepository.positionOfQuestion(attempt.testId, questionId);
    if (position === null || position > attempt.currentQuestionIndex) {
      throw new AppException(
        AppErrorCode.QUESTION_NOT_REACHED_YET,
        'You cannot answer a question you have not reached yet.',
        HttpStatus.FORBIDDEN,
      );
    }

    // served_at is stamped the first time the question was fetched (getCurrentQuestion/
    // getQuestionAt); fall back to "now" (0s spent) if an answer somehow arrives first.
    const existingAnswer = await this.testAttemptAnswersRepository.byAttemptAndQuestion(attemptId, questionId);
    const servedAt = existingAnswer?.servedAt ?? new Date();
    const timeSpentSeconds = Math.max(0, Math.floor((Date.now() - servedAt.getTime()) / 1000));

    await this.testAttemptAnswersRepository.upsertAnswer(attemptId, questionId, selectedOptionIds, timeSpentSeconds);
  }

  async advanceToNextQuestion(
    attemptId: string,
    candidateId: string,
  ): Promise<{ currentQuestionIndex: number; completed: boolean }> {
    const attempt = await this.guardActive(await this.getOwnedAttempt(attemptId, candidateId));
    const totalQuestions = await this.testsRepository.countQuestions(attempt.testId);

    const nextIndex = Math.min(attempt.currentQuestionIndex + 1, totalQuestions);
    await this.testAttemptsRepository.updateCurrentQuestionIndex(attempt.id, nextIndex);

    return { currentQuestionIndex: nextIndex, completed: nextIndex >= totalQuestions };
  }

  /** Grades every answered question at submit time (not as-you-go, keeps the
   * per-answer path cheap) and never returns per-question correctness or
   * explanations - results stay hidden until an admin releases them (Feature 5). */
  async submitTest(attemptId: string, candidateId: string): Promise<{ score: number; totalQuestions: number }> {
    const attempt = await this.getOwnedAttempt(attemptId, candidateId);

    if (attempt.status === TestAttemptStatus.SUBMITTED) {
      throw new AppException(
        AppErrorCode.TEST_ATTEMPT_ALREADY_SUBMITTED,
        'This test attempt has already been submitted.',
        HttpStatus.CONFLICT,
      );
    }

    // A candidate can still submit whatever they answered right as time runs out;
    // just make sure the attempt is marked expired if it wasn't already.
    if (attempt.status !== TestAttemptStatus.EXPIRED && this.computeRemainingSeconds(attempt) <= 0) {
      await this.testAttemptsRepository.markExpired(attempt.id);
    }

    const questionIds = await this.testsRepository.listQuestionIdsInOrder(attempt.testId);
    const answers = await this.testAttemptAnswersRepository.allForAttempt(attemptId);
    const answersByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]));

    let score = 0;
    for (const questionId of questionIds) {
      const answer = answersByQuestionId.get(questionId);
      if (!answer || answer.answeredAt === null) {
        continue;
      }

      const question = await this.questionsRepository.byId(questionId);
      if (!question) {
        continue;
      }

      const isCorrect = this.isAnswerCorrect(answer.selectedOptionIds, question.correctOptionIds);
      await this.testAttemptAnswersRepository.markGraded(answer.id, isCorrect);
      if (isCorrect) {
        score += 1;
      }
    }

    await this.testAttemptsRepository.markSubmitted(attempt.id, score);

    return { score, totalQuestions: questionIds.length };
  }

  private isAnswerCorrect(selectedOptionIds: string[], correctOptionIds: string[]): boolean {
    const selectedSet = new Set(selectedOptionIds);
    const correctSet = new Set(correctOptionIds);
    return selectedSet.size === correctSet.size && [...correctSet].every((id) => selectedSet.has(id));
  }

  private async serveQuestionAtPosition(attempt: TestAttemptEntity, position: number): Promise<QuestionForCandidate> {
    const testQuestion = await this.testsRepository.questionAtPosition(attempt.testId, position);
    if (!testQuestion) {
      throw new AppException(AppErrorCode.QUESTION_NOT_FOUND, 'Question not found for this test.', HttpStatus.NOT_FOUND);
    }

    const question = await this.questionsRepository.byId(testQuestion.questionId);
    if (!question) {
      throw new AppException(AppErrorCode.QUESTION_NOT_FOUND, 'Question not found.', HttpStatus.NOT_FOUND);
    }

    const answer = await this.testAttemptAnswersRepository.recordServedIfAbsent(attempt.id, question.id);

    // Candidates must never see the answer key mid-test - correctOptionIds/explanation
    // are deliberately left off this response shape.
    return {
      id: question.id,
      questionText: question.questionText,
      imageUrl: question.imageUrl,
      options: question.options,
      questionType: question.questionType,
      selectedOptionIds: answer.answeredAt ? answer.selectedOptionIds : null,
    };
  }

  private async getOwnedAttempt(attemptId: string, candidateId: string): Promise<TestAttemptEntity> {
    const attempt = await this.testAttemptsRepository.byId(attemptId);
    if (!attempt || attempt.candidateId !== candidateId) {
      throw new AppException(AppErrorCode.TEST_ATTEMPT_NOT_FOUND, 'Test attempt not found.', HttpStatus.NOT_FOUND);
    }
    return attempt;
  }

  /** Single reusable guard: any candidate-facing action on an in-progress attempt
   * must check remaining time first and flip it to expired before rejecting,
   * rather than duplicating this check ad-hoc in every method. */
  private async guardActive(attempt: TestAttemptEntity): Promise<TestAttemptEntity> {
    if (attempt.status === TestAttemptStatus.SUBMITTED) {
      throw new AppException(
        AppErrorCode.TEST_ATTEMPT_ALREADY_SUBMITTED,
        'This test attempt has already been submitted.',
        HttpStatus.CONFLICT,
      );
    }

    if (attempt.status === TestAttemptStatus.EXPIRED) {
      throw new AppException(AppErrorCode.TEST_ATTEMPT_EXPIRED, 'This test attempt has expired.', HttpStatus.GONE);
    }

    if (this.computeRemainingSeconds(attempt) <= 0) {
      await this.testAttemptsRepository.markExpired(attempt.id);
      throw new AppException(AppErrorCode.TEST_ATTEMPT_EXPIRED, 'This test attempt has expired.', HttpStatus.GONE);
    }

    return attempt;
  }

  private toStatusView(attempt: TestAttemptEntity, totalQuestions: number): AttemptStatusView {
    return {
      attemptId: attempt.id,
      remainingSeconds: this.computeRemainingSeconds(attempt),
      currentQuestionIndex: attempt.currentQuestionIndex,
      totalQuestions,
      status: attempt.status,
    };
  }
}
