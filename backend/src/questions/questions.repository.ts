import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { PG_POOL } from '../database/database.providers';
import { QuestionDifficulty, QuestionEntity, QuestionOption, QuestionType } from './entities/question.entity';

interface QuestionRow {
  id: string;
  domain: string;
  topic: string;
  subpattern: string | null;
  difficulty: string;
  question_type: string;
  passage_id: string | null;
  question_text: string;
  image_url: string | null;
  options: QuestionOption[];
  correct_option_ids: string[];
  explanation: string;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
}

function toEntity(row: QuestionRow): QuestionEntity {
  return {
    id: row.id,
    domain: row.domain,
    topic: row.topic,
    subpattern: row.subpattern,
    difficulty: row.difficulty as QuestionDifficulty,
    questionType: row.question_type as QuestionType,
    passageId: row.passage_id,
    questionText: row.question_text,
    imageUrl: row.image_url,
    options: row.options,
    correctOptionIds: row.correct_option_ids,
    explanation: row.explanation,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export interface CreateQuestionParams {
  domain: string;
  topic: string;
  subpattern: string | null;
  difficulty: QuestionDifficulty;
  questionType: QuestionType;
  passageId: string | null;
  questionText: string;
  imageUrl: string | null;
  options: QuestionOption[];
  correctOptionIds: string[];
  explanation: string;
}

export interface QuestionListFilters {
  domain?: string;
  topic?: string;
  difficulty?: QuestionDifficulty;
}

export interface DomainTopicCount {
  domain: string;
  topic: string;
  count: number;
}

@Injectable()
export class QuestionsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(params: CreateQuestionParams): Promise<QuestionEntity> {
    const result: QueryResult<QuestionRow> = await this.pool.query(
      `INSERT INTO questions
         (domain, topic, subpattern, difficulty, question_type, passage_id, question_text, image_url, options, correct_option_ids, explanation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        params.domain,
        params.topic,
        params.subpattern,
        params.difficulty,
        params.questionType,
        params.passageId,
        params.questionText,
        params.imageUrl,
        JSON.stringify(params.options),
        JSON.stringify(params.correctOptionIds),
        params.explanation,
      ],
    );
    return toEntity(result.rows[0]);
  }

  async bulkInsert(paramsList: CreateQuestionParams[]): Promise<QuestionEntity[]> {
    if (paramsList.length === 0) {
      return [];
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const inserted: QuestionEntity[] = [];
      for (const params of paramsList) {
        const result: QueryResult<QuestionRow> = await client.query(
          `INSERT INTO questions
             (domain, topic, subpattern, difficulty, question_type, passage_id, question_text, image_url, options, correct_option_ids, explanation)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            params.domain,
            params.topic,
            params.subpattern,
            params.difficulty,
            params.questionType,
            params.passageId,
            params.questionText,
            params.imageUrl,
            JSON.stringify(params.options),
            JSON.stringify(params.correctOptionIds),
            params.explanation,
          ],
        );
        inserted.push(toEntity(result.rows[0]));
      }
      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async byId(id: string): Promise<QuestionEntity | null> {
    const result: QueryResult<QuestionRow> = await this.pool.query(
      `SELECT * FROM questions WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async list(filters: QuestionListFilters, offset: number, limit: number): Promise<{ items: QuestionEntity[]; total: number }> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const values: unknown[] = [];

    if (filters.domain) {
      values.push(filters.domain);
      conditions.push(`domain = $${values.length}`);
    }
    if (filters.topic) {
      values.push(filters.topic);
      conditions.push(`topic = $${values.length}`);
    }
    if (filters.difficulty) {
      values.push(filters.difficulty);
      conditions.push(`difficulty = $${values.length}`);
    }

    const whereClause = conditions.join(' AND ');

    const countResult: QueryResult<{ count: string }> = await this.pool.query(
      `SELECT COUNT(*) AS count FROM questions WHERE ${whereClause}`,
      values,
    );
    const total = Number(countResult.rows[0].count);

    values.push(limit);
    const limitIndex = values.length;
    values.push(offset);
    const offsetIndex = values.length;

    const result: QueryResult<QuestionRow> = await this.pool.query(
      `SELECT * FROM questions
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values,
    );

    return { items: result.rows.map(toEntity), total };
  }

  async countByDomainTopic(): Promise<DomainTopicCount[]> {
    const result: QueryResult<{ domain: string; topic: string; count: string }> = await this.pool.query(
      `SELECT domain, topic, COUNT(*) AS count
       FROM questions
       WHERE deleted_at IS NULL
       GROUP BY domain, topic
       ORDER BY domain, topic`,
    );
    return result.rows.map((row) => ({ domain: row.domain, topic: row.topic, count: Number(row.count) }));
  }
}
