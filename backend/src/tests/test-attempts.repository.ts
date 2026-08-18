import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient, QueryResult } from 'pg';
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
  results_include_answers: boolean;
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
    resultsIncludeAnswers: row.results_include_answers,
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

export interface TestAttemptListFilters {
  candidateId?: string;
  testId?: string;
  status?: TestAttemptStatus;
}

export interface TestAttemptSummaryRow {
  id: string;
  status: string;
  score: number | null;
  current_question_index: number;
  started_at: Date;
  submitted_at: Date | null;
  results_released_at: Date | null;
  results_include_answers: boolean;
  candidate_id: string;
  candidate_login_id: string;
  candidate_display_name: string;
  test_id: string;
  test_title: string;
}

export interface TestAttemptSummary {
  id: string;
  candidate: { id: string; loginId: string; displayName: string };
  test: { id: string; title: string };
  status: TestAttemptStatus;
  score: number | null;
  currentQuestionIndex: number;
  startedAt: Date;
  submittedAt: Date | null;
  resultsReleasedAt: Date | null;
  resultsIncludeAnswers: boolean;
}

function toSummary(row: TestAttemptSummaryRow): TestAttemptSummary {
  return {
    id: row.id,
    candidate: {
      id: row.candidate_id,
      loginId: row.candidate_login_id,
      displayName: row.candidate_display_name,
    },
    test: {
      id: row.test_id,
      title: row.test_title,
    },
    status: row.status as TestAttemptStatus,
    score: row.score,
    currentQuestionIndex: row.current_question_index,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    resultsReleasedAt: row.results_released_at,
    resultsIncludeAnswers: row.results_include_answers,
  };
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

  /** Used by the available-tests list so the candidate sees "Continue Test"
   * (with the existing attempt id) instead of "Start Test" for a test they
   * already have an in-progress attempt on. */
  async activeAttemptIdsByTestForCandidate(candidateId: string): Promise<Map<string, string>> {
    const result: QueryResult<{ test_id: string; id: string }> = await this.pool.query(
      `SELECT test_id, id FROM test_attempts
       WHERE candidate_id = $1 AND status = $2 AND deleted_at IS NULL`,
      [candidateId, TestAttemptStatus.IN_PROGRESS],
    );
    return new Map(result.rows.map((row) => [row.test_id, row.id]));
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

  /** Used by ExtensionRequestService.approve() inside a transaction shared with
   * ExtensionRequestsRepository.markApproved(). Grants extra time and, when the
   * attempt had expired, flips it back to in_progress so the candidate can resume -
   * an approved extension un-expires the attempt. The DB-level CHECK constraint
   * (base + extended <= 7200) still applies and will reject the update if violated. */
  async applyExtension(
    id: string,
    extendedSeconds: number,
    reactivateIfExpired: boolean,
    client?: PoolClient,
  ): Promise<TestAttemptEntity | null> {
    const executor = client ?? this.pool;
    const result: QueryResult<TestAttemptRow> = await executor.query(
      `UPDATE test_attempts
       SET extended_seconds = $2,
           status = CASE WHEN $3 AND status = $4 THEN $5 ELSE status END,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, extendedSeconds, reactivateIfExpired, TestAttemptStatus.EXPIRED, TestAttemptStatus.IN_PROGRESS],
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

  /** Admin dashboard listing - joins candidate and test details in a single query
   * since there are no FK constraints (SCHEMA.md) but plain SQL JOINs on the id
   * columns work fine. */
  async listWithFilters(
    filters: TestAttemptListFilters,
    offset: number,
    limit: number,
  ): Promise<{ items: TestAttemptSummary[]; total: number }> {
    const conditions: string[] = ['ta.deleted_at IS NULL'];
    const values: unknown[] = [];

    if (filters.candidateId) {
      values.push(filters.candidateId);
      conditions.push(`ta.candidate_id = $${values.length}`);
    }
    if (filters.testId) {
      values.push(filters.testId);
      conditions.push(`ta.test_id = $${values.length}`);
    }
    if (filters.status) {
      values.push(filters.status);
      conditions.push(`ta.status = $${values.length}`);
    }

    const whereClause = conditions.join(' AND ');

    const countResult: QueryResult<{ count: string }> = await this.pool.query(
      `SELECT COUNT(*) AS count FROM test_attempts ta WHERE ${whereClause}`,
      values,
    );
    const total = Number(countResult.rows[0].count);

    values.push(limit);
    const limitIndex = values.length;
    values.push(offset);
    const offsetIndex = values.length;

    const result: QueryResult<TestAttemptSummaryRow> = await this.pool.query(
      `SELECT
         ta.id AS id,
         ta.status AS status,
         ta.score AS score,
         ta.current_question_index AS current_question_index,
         ta.started_at AS started_at,
         ta.submitted_at AS submitted_at,
         ta.results_released_at AS results_released_at,
         ta.results_include_answers AS results_include_answers,
         u.id AS candidate_id,
         u.login_id AS candidate_login_id,
         u.display_name AS candidate_display_name,
         t.id AS test_id,
         t.title AS test_title
       FROM test_attempts ta
       JOIN users u ON u.id = ta.candidate_id
       JOIN tests t ON t.id = ta.test_id
       WHERE ${whereClause}
       ORDER BY ta.created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values,
    );

    return { items: result.rows.map(toSummary), total };
  }

  /** Releases graded results to the candidate. Only a submitted attempt has a
   * final score worth releasing - an in-progress or expired-but-unsubmitted
   * attempt has nothing to show, so this is a no-op (returns null) for those. */
  async markResultsReleased(id: string, includeAnswers: boolean): Promise<TestAttemptEntity | null> {
    const result: QueryResult<TestAttemptRow> = await this.pool.query(
      `UPDATE test_attempts
       SET results_released_at = NOW(), results_include_answers = $3, updated_at = NOW()
       WHERE id = $1 AND status = $2 AND deleted_at IS NULL
       RETURNING *`,
      [id, TestAttemptStatus.SUBMITTED, includeAnswers],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }
}
