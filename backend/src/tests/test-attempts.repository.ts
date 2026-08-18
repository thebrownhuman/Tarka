import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { PG_POOL } from '../database/database.providers';
import { TestAttemptEntity, TestAttemptStatus } from './entities/test-attempt.entity';

interface TestAttemptRow {
  id: string;
  test_id: string;
  candidate_id: string;
  status: string;
  started_at: Date;
  base_duration_seconds: number;
  extended_seconds: number;
  current_question_index: number;
  submitted_at: Date | null;
  score: number | null;
  results_released_at: Date | null;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
}

function toEntity(row: TestAttemptRow): TestAttemptEntity {
  return {
    id: row.id,
    testId: row.test_id,
    candidateId: row.candidate_id,
    status: row.status as TestAttemptStatus,
    startedAt: row.started_at,
    baseDurationSeconds: row.base_duration_seconds,
    extendedSeconds: row.extended_seconds,
    currentQuestionIndex: row.current_question_index,
    submittedAt: row.submitted_at,
    score: row.score,
    resultsReleasedAt: row.results_released_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export interface CreateTestAttemptParams {
  testId: string;
  candidateId: string;
  baseDurationSeconds: number;
}

@Injectable()
export class TestAttemptsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(params: CreateTestAttemptParams): Promise<TestAttemptEntity> {
    const result: QueryResult<TestAttemptRow> = await this.pool.query(
      `INSERT INTO test_attempts (test_id, candidate_id, base_duration_seconds)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [params.testId, params.candidateId, params.baseDurationSeconds],
    );
    return toEntity(result.rows[0]);
  }

  async byId(id: string): Promise<TestAttemptEntity | null> {
    const result: QueryResult<TestAttemptRow> = await this.pool.query(
      `SELECT * FROM test_attempts WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  /** Finds an existing non-terminal attempt so a candidate resuming after a
   * disconnect gets the same attempt back instead of starting a new timer. */
  async activeAttemptForCandidate(testId: string, candidateId: string): Promise<TestAttemptEntity | null> {
    const result: QueryResult<TestAttemptRow> = await this.pool.query(
      `SELECT * FROM test_attempts
       WHERE test_id = $1 AND candidate_id = $2 AND status = $3 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [testId, candidateId, TestAttemptStatus.IN_PROGRESS],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async updateCurrentQuestionIndex(id: string, currentQuestionIndex: number): Promise<TestAttemptEntity | null> {
    const result: QueryResult<TestAttemptRow> = await this.pool.query(
      `UPDATE test_attempts
       SET current_question_index = $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, currentQuestionIndex],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  /** Feature 4 (extension requests) will call this to grant extra time.
   * The DB-level CHECK constraint (base + extended <= 7200) still applies. */
  async updateExtendedSeconds(id: string, extendedSeconds: number): Promise<TestAttemptEntity | null> {
    const result: QueryResult<TestAttemptRow> = await this.pool.query(
      `UPDATE test_attempts
       SET extended_seconds = $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, extendedSeconds],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async markSubmitted(id: string, score: number): Promise<TestAttemptEntity | null> {
    const result: QueryResult<TestAttemptRow> = await this.pool.query(
      `UPDATE test_attempts
       SET status = $2, score = $3, submitted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, TestAttemptStatus.SUBMITTED, score],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async markExpired(id: string): Promise<TestAttemptEntity | null> {
    const result: QueryResult<TestAttemptRow> = await this.pool.query(
      `UPDATE test_attempts
       SET status = $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, TestAttemptStatus.EXPIRED],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }
}
