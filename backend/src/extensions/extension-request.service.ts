import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.providers';
import { ExtensionRequestsRepository, isCheckViolation, isUniqueViolation } from './extension-requests.repository';
import { ExtensionRequestEntity, ExtensionRequestStatus } from './entities/extension-request.entity';
import { TestAttemptsRepository } from '../tests/test-attempts.repository';
import { TestAttemptEntity, TestAttemptStatus } from '../tests/entities/test-attempt.entity';
import { AppException } from '../common/errors/app.exception';
import { AppErrorCode } from '../common/errors/app-error-code';

// Hard cap already enforced by the DB CHECK constraint on test_attempts
// (base_duration_seconds + extended_seconds <= 7200); mirrored here so we can
// give the admin a clear validation message before writing anything.
const MAX_TOTAL_DURATION_SECONDS = 7200;

export interface ExtensionRequestListResult {
  items: ExtensionRequestEntity[];
  total: number;
  offset: number;
  limit: number;
}

export interface ApproveExtensionResult {
  request: ExtensionRequestEntity;
  attempt: TestAttemptEntity;
}

@Injectable()
export class ExtensionRequestService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly extensionRequestsRepository: ExtensionRequestsRepository,
    private readonly testAttemptsRepository: TestAttemptsRepository,
  ) {}

  async requestExtension(
    attemptId: string,
    candidateId: string,
    requestedSeconds: number | undefined,
  ): Promise<ExtensionRequestEntity> {
    const attempt = await this.testAttemptsRepository.byId(attemptId);
    if (!attempt || attempt.candidateId !== candidateId) {
      throw new AppException(AppErrorCode.TEST_ATTEMPT_NOT_FOUND, 'Test attempt not found.', HttpStatus.NOT_FOUND);
    }

    // Submitted attempts are closed for good. An expired-but-not-submitted attempt
    // CAN request an extension - expired just means the timer hit 0, and that is
    // exactly the case this feature exists to resolve.
    if (attempt.status === TestAttemptStatus.SUBMITTED) {
      throw new AppException(
        AppErrorCode.TEST_ATTEMPT_ALREADY_SUBMITTED,
        'This test attempt has already been submitted.',
        HttpStatus.CONFLICT,
      );
    }

    // Fast, friendly pre-check. Not the real guard - two concurrent requests could
    // both pass this check, so the DB unique partial index (one pending request per
    // attempt) is what actually prevents the race; see the catch block below.
    const existingPending = await this.extensionRequestsRepository.pendingForAttempt(attemptId);
    if (existingPending) {
      throw new AppException(
        AppErrorCode.EXTENSION_REQUEST_ALREADY_PENDING,
        'This attempt already has a pending extension request.',
        HttpStatus.CONFLICT,
      );
    }

    try {
      return await this.extensionRequestsRepository.insert(attemptId, requestedSeconds ?? null);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppException(
          AppErrorCode.EXTENSION_REQUEST_ALREADY_PENDING,
          'This attempt already has a pending extension request.',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async listPending(offset: number, limit: number): Promise<ExtensionRequestListResult> {
    return this.listAll(ExtensionRequestStatus.PENDING, offset, limit);
  }

  async listAll(
    status: ExtensionRequestStatus | undefined,
    offset: number,
    limit: number,
  ): Promise<ExtensionRequestListResult> {
    const result = await this.extensionRequestsRepository.list(status, offset, limit);
    return { items: result.items, total: result.total, offset, limit };
  }

  async approve(requestId: string, grantedSeconds: number, adminUserId: string): Promise<ApproveExtensionResult> {
    const request = await this.getResolvableRequest(requestId);
    const attempt = await this.testAttemptsRepository.byId(request.attemptId);
    if (!attempt) {
      throw new AppException(AppErrorCode.TEST_ATTEMPT_NOT_FOUND, 'Test attempt not found.', HttpStatus.NOT_FOUND);
    }

    const newExtendedSeconds = attempt.extendedSeconds + grantedSeconds;
    if (attempt.baseDurationSeconds + newExtendedSeconds > MAX_TOTAL_DURATION_SECONDS) {
      throw new AppException(
        AppErrorCode.EXTENSION_EXCEEDS_MAX_DURATION,
        `Granting ${grantedSeconds}s would push this attempt over the 7200s (2 hour) cap.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const updatedAttempt = await this.testAttemptsRepository.applyExtension(
        attempt.id,
        newExtendedSeconds,
        attempt.status === TestAttemptStatus.EXPIRED,
        client,
      );
      if (!updatedAttempt) {
        throw new AppException(AppErrorCode.TEST_ATTEMPT_NOT_FOUND, 'Test attempt not found.', HttpStatus.NOT_FOUND);
      }

      const updatedRequest = await this.extensionRequestsRepository.markApproved(
        requestId,
        grantedSeconds,
        adminUserId,
        client,
      );
      if (!updatedRequest) {
        throw new AppException(
          AppErrorCode.EXTENSION_REQUEST_NOT_FOUND,
          'Extension request not found.',
          HttpStatus.NOT_FOUND,
        );
      }

      await client.query('COMMIT');
      return { request: updatedRequest, attempt: updatedAttempt };
    } catch (err) {
      await client.query('ROLLBACK');

      // Defense-in-depth: if the DB CHECK constraint still rejects the update for
      // any reason not covered by the pre-check above, surface a clean error
      // instead of a raw 500.
      if (isCheckViolation(err)) {
        throw new AppException(
          AppErrorCode.EXTENSION_EXCEEDS_MAX_DURATION,
          'Granting this extension would exceed the 7200s (2 hour) cap for this attempt.',
          HttpStatus.BAD_REQUEST,
        );
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async deny(requestId: string, adminNote: string | undefined, adminUserId: string): Promise<ExtensionRequestEntity> {
    await this.getResolvableRequest(requestId);

    const updated = await this.extensionRequestsRepository.markDenied(requestId, adminNote ?? null, adminUserId);
    if (!updated) {
      throw new AppException(
        AppErrorCode.EXTENSION_REQUEST_NOT_FOUND,
        'Extension request not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return updated;
  }

  private async getResolvableRequest(requestId: string): Promise<ExtensionRequestEntity> {
    const request = await this.extensionRequestsRepository.byId(requestId);
    if (!request) {
      throw new AppException(
        AppErrorCode.EXTENSION_REQUEST_NOT_FOUND,
        'Extension request not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (request.status !== ExtensionRequestStatus.PENDING) {
      throw new AppException(
        AppErrorCode.EXTENSION_REQUEST_ALREADY_RESOLVED,
        'This extension request has already been resolved.',
        HttpStatus.CONFLICT,
      );
    }

    return request;
  }
}
