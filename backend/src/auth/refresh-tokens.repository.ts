import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { PG_POOL } from '../database/database.providers';
import { RefreshTokenEntity } from './entities/refresh-token.entity';

interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
}

function toEntity(row: RefreshTokenRow): RefreshTokenEntity {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

@Injectable()
export class RefreshTokensRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(userId: string, tokenHash: string, expiresAt: Date): Promise<RefreshTokenEntity> {
    const result: QueryResult<RefreshTokenRow> = await this.pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, tokenHash, expiresAt],
    );
    return toEntity(result.rows[0]);
  }

  async byTokenHashActive(tokenHash: string): Promise<RefreshTokenEntity | null> {
    const result: QueryResult<RefreshTokenRow> = await this.pool.query(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = $1 AND deleted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async revokeById(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW(), updated_at = NOW() WHERE id = $1 AND revoked_at IS NULL`,
      [id],
    );
  }

  async revokeByTokenHash(tokenHash: string): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW(), updated_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    );
  }
}
