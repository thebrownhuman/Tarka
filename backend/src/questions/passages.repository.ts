import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient, QueryResult } from 'pg';
import { PG_POOL } from '../database/database.providers';
import { PassageEntity } from './entities/passage.entity';

interface PassageRow {
  id: string;
  text: string;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
}

function toEntity(row: PassageRow): PassageEntity {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

@Injectable()
export class PassagesRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(text: string, client?: PoolClient): Promise<PassageEntity> {
    const runner = client ?? this.pool;
    const result: QueryResult<PassageRow> = await runner.query(
      `INSERT INTO passages (text) VALUES ($1) RETURNING *`,
      [text],
    );
    return toEntity(result.rows[0]);
  }

  async byId(id: string): Promise<PassageEntity | null> {
    const result: QueryResult<PassageRow> = await this.pool.query(
      `SELECT * FROM passages WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }
}
