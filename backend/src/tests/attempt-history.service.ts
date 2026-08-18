import { HttpStatus, Injectable } from '@nestjs/common';
import { TestsRepository } from './tests.repository';
import { TestAttemptsRepository } from './test-attempts.repository';
import { AttemptAnswerDetail, TestAttemptAnswersRepository } from './test-attempt-answers.repository';
import { TestAttemptEntity, TestAttemptStatus } from './entities/test-attempt.entity';
import { AppException } from '../common/errors/app.exception';
import { AppErrorCode } from '../common/errors/app-error-code';

export interface CandidateAttemptHistoryItem {
  id: string;
  test: { id: string; title: string };
  status: TestAttemptStatus;
  submittedAt: Date | null;
  resultsReleasedAt: Date | null;
  score: number | null;
}

export interface CandidateAttemptHistoryResult {
  items: CandidateAttemptHistoryItem[];
  total: number;
  offset: number;
  limit: number;
}

export interface AttemptDetailResult {
  attemptId: string;
  testId: string;
  testTitle: string;
  candidateId: string;
  status: TestAttemptStatus;
  score: number | null;
  totalQuestions: number;
  submittedAt: Date | null;
  resultsReleasedAt: Date | null;
  resultsIncludeAnswers: boolean;
  answers: AttemptAnswerDetail[];
}

@Injectable()
export class AttemptHistoryService {
  constructor(
    private readonly testsRepository: TestsRepository,
    private readonly testAttemptsRepository: TestAttemptsRepository,
    private readonly testAttemptAnswersRepository: TestAttemptAnswersRepository,
  ) {}

  /** Candidate-facing list of their own attempts. Reuses the admin listWithFilters
   * query scoped to candidateId - same shape Feature 5 built, just filtered to one
   * candidate instead of admin-supplied filters. */
  async getCandidateHistory(
    candidateId: string,
    offset: number,
    limit: number,
  ): Promise<CandidateAttemptHistoryResult> {
    const result = await this.testAttemptsRepository.listWithFilters({ candidateId }, offset, limit);

    const items: CandidateAttemptHistoryItem[] = result.items.map((item) => ({
      id: item.id,
      test: { id: item.test.id, title: item.test.title },
      status: item.status,
      submittedAt: item.submittedAt,
      resultsReleasedAt: item.resultsReleasedAt,
      // Score is only meaningful to the candidate once an admin releases results -
      // strip it here in the service rather than trusting callers to hide it.
      score: item.resultsReleasedAt ? item.score : null,
    }));

    return { items, total: result.total, offset, limit };
  }

  /** Candidate detail view - ownership-checked and release-gated. Before release
   * the candidate can already see the attempt exists via getCandidateHistory
   * (status/submitted_at); this endpoint is specifically for the graded
   * per-question breakdown, which stays hidden until release. */
  async getCandidateAttemptDetail(attemptId: string, candidateId: string): Promise<AttemptDetailResult> {
    const attempt = await this.getOwnedAttempt(attemptId, candidateId);

    if (!attempt.resultsReleasedAt) {
      throw new AppException(
        AppErrorCode.RESULTS_NOT_YET_RELEASED,
        'Results for this test attempt have not been released yet.',
        HttpStatus.FORBIDDEN,
      );
    }

    const detail = await this.buildDetail(attempt);
    if (attempt.resultsIncludeAnswers) {
      return detail;
    }

    // Basic release: the candidate learns whether their own answer was right
    // or wrong (isCorrect/selectedOptionIds stay intact) and never sees the
    // explanation. The answer key is only kept when it matches what they
    // already answered correctly - it reveals nothing new in that case, but
    // is stripped whenever they got a question wrong or left it blank.
    return {
      ...detail,
      answers: detail.answers.map((answer) => ({
        ...answer,
        correctOptionIds: answer.isCorrect === true ? answer.correctOptionIds : [],
        explanation: '',
      })),
    };
  }

  /** Admin detail view - no ownership check, no release-gate. Admins need full
   * visibility into any attempt at any time to decide whether to release it. */
  async getAdminAttemptDetail(attemptId: string): Promise<AttemptDetailResult> {
    const attempt = await this.testAttemptsRepository.byId(attemptId);
    if (!attempt) {
      throw new AppException(AppErrorCode.TEST_ATTEMPT_NOT_FOUND, 'Test attempt not found.', HttpStatus.NOT_FOUND);
    }

    return this.buildDetail(attempt);
  }

  private async getOwnedAttempt(attemptId: string, candidateId: string): Promise<TestAttemptEntity> {
    const attempt = await this.testAttemptsRepository.byId(attemptId);
    if (!attempt || attempt.candidateId !== candidateId) {
      throw new AppException(AppErrorCode.TEST_ATTEMPT_NOT_FOUND, 'Test attempt not found.', HttpStatus.NOT_FOUND);
    }
    return attempt;
  }

  private async buildDetail(attempt: TestAttemptEntity): Promise<AttemptDetailResult> {
    const test = await this.testsRepository.byId(attempt.testId);
    if (!test) {
      throw new AppException(AppErrorCode.TEST_NOT_FOUND, 'Test not found.', HttpStatus.NOT_FOUND);
    }

    const totalQuestions = await this.testsRepository.countQuestions(attempt.testId);
    const answers = await this.testAttemptAnswersRepository.detailedForAttempt(attempt.id);

    return {
      attemptId: attempt.id,
      testId: test.id,
      testTitle: test.title,
      candidateId: attempt.candidateId,
      status: attempt.status,
      score: attempt.score,
      totalQuestions,
      submittedAt: attempt.submittedAt,
      resultsReleasedAt: attempt.resultsReleasedAt,
      resultsIncludeAnswers: attempt.resultsIncludeAnswers,
      answers,
    };
  }
}
