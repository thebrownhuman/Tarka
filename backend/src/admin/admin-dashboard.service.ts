import { HttpStatus, Injectable } from '@nestjs/common';
import { UsersRepository } from '../users/users.repository';
import { UserEntity } from '../users/entities/user.entity';
import {
  TestAttemptListFilters,
  TestAttemptSummary,
  TestAttemptsRepository,
} from '../tests/test-attempts.repository';
import { TestAttemptEntity, TestAttemptStatus } from '../tests/entities/test-attempt.entity';
import { AppException } from '../common/errors/app.exception';
import { AppErrorCode } from '../common/errors/app-error-code';

export interface CandidateListResult {
  items: UserEntity[];
  total: number;
  offset: number;
  limit: number;
}

export interface AttemptListResult {
  items: TestAttemptSummary[];
  total: number;
  offset: number;
  limit: number;
}

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly testAttemptsRepository: TestAttemptsRepository,
  ) {}

  async listCandidates(offset: number, limit: number): Promise<CandidateListResult> {
    const result = await this.usersRepository.listCandidates(offset, limit);
    return { items: result.items, total: result.total, offset, limit };
  }

  async listAttempts(filters: TestAttemptListFilters, offset: number, limit: number): Promise<AttemptListResult> {
    const result = await this.testAttemptsRepository.listWithFilters(filters, offset, limit);
    return { items: result.items, total: result.total, offset, limit };
  }

  async releaseResults(attemptId: string, includeAnswers: boolean): Promise<TestAttemptEntity> {
    const attempt = await this.testAttemptsRepository.byId(attemptId);
    if (!attempt) {
      throw new AppException(AppErrorCode.TEST_ATTEMPT_NOT_FOUND, 'Test attempt not found.', HttpStatus.NOT_FOUND);
    }

    if (attempt.status !== TestAttemptStatus.SUBMITTED) {
      throw new AppException(
        AppErrorCode.TEST_ATTEMPT_NOT_SUBMITTED,
        'Results can only be released for a submitted test attempt.',
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.testAttemptsRepository.markResultsReleased(attemptId, includeAnswers);
    if (!updated) {
      throw new AppException(
        AppErrorCode.TEST_ATTEMPT_NOT_SUBMITTED,
        'Results can only be released for a submitted test attempt.',
        HttpStatus.CONFLICT,
      );
    }

    return updated;
  }
}
