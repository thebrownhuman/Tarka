import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { PG_POOL } from '../database/database.providers';
import { TestAttemptAnswerEntity } from './entities/test-attempt-answer.entity';
import { QuestionOption, QuestionType } from '../questions/entities/question.entity';

interface TestAttemptAnswerRow {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option_ids: string[];
  is_correct: boolean | null;
  served_at: Date;
  answered_at: Date | null;
  time_spent_seconds: number | null;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
}

function toEntity(row: TestAttemptAnswerRow): TestAttemptAnswerEntity {
  return {
    id: row.id,
    attemptId: row.attempt_id,
    questionId: row.question_id,
    selectedOptionIds: row.selected_option_ids,
    isCorrect: row.is_correct,
    servedAt: row.served_at,
    answeredAt: row.answered_at,
    timeSpentSeconds: row.time_spent_seconds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

interface AttemptAnswerDetailRow {
  question_id: string;
  position: number;
  question_text: string;
  image_url: string | null;
  question_type: string;
  options: QuestionOption[];
  passage_text: string | null;
  correct_option_ids: string[];
  explanation: string;
  selected_option_ids: string[];
  is_correct: boolean | null;
  time_spent_seconds: number | null;
  answered_at: Date | null;
}

export interface AttemptAnswerDetail {
  questionId: string;
  position: number;
  questionText: string;
  imageUrl: string | null;
  questionType: QuestionType;
  options: QuestionOption[];
  passageText: string | null;
  correctOptionIds: string[];
  explanation: string;
  selectedOptionIds: string[];
  isCorrect: boolean | null;
  timeSpentSeconds: number | null;
  answeredAt: Date | null;
}

function toDetail(row: AttemptAnswerDetailRow): AttemptAnswerDetail {
  return {
    questionId: row.question_id,
    position: row.position,
    questionText: row.question_text,
    imageUrl: row.image_url,
    questionType: row.question_type as QuestionType,
    options: row.options,
    passageText: row.passage_text,
    correctOptionIds: row.correct_option_ids,
    explanation: row.explanation,
    selectedOptionIds: row.selected_option_ids,
    isCorrect: row.is_correct,
    timeSpentSeconds: row.time_spent_seconds,
    answeredAt: row.answered_at,
  };
}

@Injectable()
export class TestAttemptAnswersRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Creates the answer row with served_at = NOW() the first time a question is
   * fetched, so time-spent can be computed later. No-op if it already exists. */
  async recordServedIfAbsent(attemptId: string, questionId: string): Promise<TestAttemptAnswerEntity> {
    const result: QueryResult<TestAttemptAnswerRow> = await this.pool.query(
      `INSERT INTO test_attempt_answers (attempt_id, question_id, selected_option_ids)
       VALUES ($1, $2, '[]'::jsonb)
       ON CONFLICT (attempt_id, question_id) WHERE deleted_at IS NULL
       DO NOTHING
       RETURNING *`,
      [attemptId, questionId],
    );

    if (result.rows[0]) {
      return toEntity(result.rows[0]);
    }

    const existing = await this.byAttemptAndQuestion(attemptId, questionId);
    if (!existing) {
      throw new Error(`Failed to record served answer row for attempt ${attemptId}, question ${questionId}`);
    }
    return existing;
  }

  /** Insert-or-update the candidate's selection for a question (one row per
   * attempt+question, re-answering just overwrites the previous selection). */
  async upsertAnswer(
    attemptId: string,
    questionId: string,
    selectedOptionIds: string[],
    timeSpentSeconds: number,
  ): Promise<TestAttemptAnswerEntity> {
    const result: QueryResult<TestAttemptAnswerRow> = await this.pool.query(
      `INSERT INTO test_attempt_answers (attempt_id, question_id, selected_option_ids, answered_at, time_spent_seconds)
       VALUES ($1, $2, $3, NOW(), $4)
       ON CONFLICT (attempt_id, question_id) WHERE deleted_at IS NULL
       DO UPDATE SET
         selected_option_ids = EXCLUDED.selected_option_ids,
         answered_at = NOW(),
         time_spent_seconds = $4,
         updated_at = NOW()
       RETURNING *`,
      [attemptId, questionId, JSON.stringify(selectedOptionIds), timeSpentSeconds],
    );
    return toEntity(result.rows[0]);
  }

  async markGraded(id: string, isCorrect: boolean): Promise<void> {
    await this.pool.query(`UPDATE test_attempt_answers SET is_correct = $2, updated_at = NOW() WHERE id = $1`, [
      id,
      isCorrect,
    ]);
  }

  async byAttemptAndQuestion(attemptId: string, questionId: string): Promise<TestAttemptAnswerEntity | null> {
    const result: QueryResult<TestAttemptAnswerRow> = await this.pool.query(
      `SELECT * FROM test_attempt_answers
       WHERE attempt_id = $1 AND question_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [attemptId, questionId],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async allForAttempt(attemptId: string): Promise<TestAttemptAnswerEntity[]> {
    const result: QueryResult<TestAttemptAnswerRow> = await this.pool.query(
      `SELECT * FROM test_attempt_answers WHERE attempt_id = $1 AND deleted_at IS NULL`,
      [attemptId],
    );
    return result.rows.map(toEntity);
  }

  /** Full per-question breakdown for history/analytics (Feature 6). Joins through
   * test_attempts to resolve the attempt's test, then through test_questions to get
   * each question's position within that test - no FK constraints (SCHEMA.md), so
   * this is a plain multi-table JOIN on the id columns. Passage is a nullable left
   * join since not every question has one. */
  async detailedForAttempt(attemptId: string): Promise<AttemptAnswerDetail[]> {
    const result: QueryResult<AttemptAnswerDetailRow> = await this.pool.query(
      `SELECT
         q.id AS question_id,
         tq.position AS position,
         q.question_text AS question_text,
         q.image_url AS image_url,
         q.question_type AS question_type,
         q.options AS options,
         p.text AS passage_text,
         q.correct_option_ids AS correct_option_ids,
         q.explanation AS explanation,
         taa.selected_option_ids AS selected_option_ids,
         taa.is_correct AS is_correct,
         taa.time_spent_seconds AS time_spent_seconds,
         taa.answered_at AS answered_at
       FROM test_attempt_answers taa
       JOIN test_attempts ta ON ta.id = taa.attempt_id
       JOIN questions q ON q.id = taa.question_id
       JOIN test_questions tq ON tq.test_id = ta.test_id AND tq.question_id = taa.question_id AND tq.deleted_at IS NULL
       LEFT JOIN passages p ON p.id = q.passage_id
       WHERE taa.attempt_id = $1 AND taa.deleted_at IS NULL
       ORDER BY tq.position ASC`,
      [attemptId],
    );
    return result.rows.map(toDetail);
  }
}
