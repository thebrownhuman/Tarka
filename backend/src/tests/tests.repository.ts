import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { PG_POOL } from '../database/database.providers';
import { TestEntity } from './entities/test.entity';
import { TestQuestionEntity } from './entities/test-question.entity';

interface TestRow {
  id: string;
  title: string;
  duration_seconds: number;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
}

interface TestQuestionRow {
  id: string;
  test_id: string;
  question_id: string;
  position: number;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
}

function toTestEntity(row: TestRow): TestEntity {
  return {
    id: row.id,
    title: row.title,
    durationSeconds: row.duration_seconds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toTestQuestionEntity(row: TestQuestionRow): TestQuestionEntity {
  return {
    id: row.id,
    testId: row.test_id,
    questionId: row.question_id,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export interface CreateTestParams {
  title: string;
  durationSeconds: number;
  questionIds: string[];
}

@Injectable()
export class TestsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insertWithQuestions(params: CreateTestParams): Promise<{ test: TestEntity; questionCount: number }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const testResult: QueryResult<TestRow> = await client.query(
        `INSERT INTO tests (title, duration_seconds) VALUES ($1, $2) RETURNING *`,
        [params.title, params.durationSeconds],
      );
      const test = toTestEntity(testResult.rows[0]);

      for (let position = 0; position < params.questionIds.length; position += 1) {
        await client.query(`INSERT INTO test_questions (test_id, question_id, position) VALUES ($1, $2, $3)`, [
          test.id,
          params.questionIds[position],
          position,
        ]);
      }

      await client.query('COMMIT');
      return { test, questionCount: params.questionIds.length };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async byId(id: string): Promise<TestEntity | null> {
    const result: QueryResult<TestRow> = await this.pool.query(
      `SELECT * FROM tests WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    return result.rows[0] ? toTestEntity(result.rows[0]) : null;
  }

  async listQuestionIdsInOrder(testId: string): Promise<string[]> {
    const result: QueryResult<{ question_id: string }> = await this.pool.query(
      `SELECT question_id FROM test_questions
       WHERE test_id = $1 AND deleted_at IS NULL
       ORDER BY position ASC`,
      [testId],
    );
    return result.rows.map((row) => row.question_id);
  }

  async questionAtPosition(testId: string, position: number): Promise<TestQuestionEntity | null> {
    const result: QueryResult<TestQuestionRow> = await this.pool.query(
      `SELECT * FROM test_questions
       WHERE test_id = $1 AND position = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [testId, position],
    );
    return result.rows[0] ? toTestQuestionEntity(result.rows[0]) : null;
  }

  async positionOfQuestion(testId: string, questionId: string): Promise<number | null> {
    const result: QueryResult<{ position: number }> = await this.pool.query(
      `SELECT position FROM test_questions
       WHERE test_id = $1 AND question_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [testId, questionId],
    );
    return result.rows[0] ? result.rows[0].position : null;
  }

  async countQuestions(testId: string): Promise<number> {
    const result: QueryResult<{ count: string }> = await this.pool.query(
      `SELECT COUNT(*) AS count FROM test_questions WHERE test_id = $1 AND deleted_at IS NULL`,
      [testId],
    );
    return Number(result.rows[0].count);
  }
}
