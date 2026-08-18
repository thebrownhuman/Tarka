import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { PG_POOL } from '../database/database.providers';
import { UserEntity, UserRole } from './entities/user.entity';

interface UserRow {
  id: string;
  login_id: string;
  password_hash: string;
  role: string;
  display_name: string;
  must_change_password: boolean;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
}

function toEntity(row: UserRow): UserEntity {
  return {
    id: row.id,
    loginId: row.login_id,
    passwordHash: row.password_hash,
    role: row.role as UserRole,
    displayName: row.display_name,
    mustChangePassword: row.must_change_password,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export interface CreateUserParams {
  loginId: string;
  passwordHash: string;
  role: UserRole;
  displayName: string;
  mustChangePassword: boolean;
}

@Injectable()
export class UsersRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(params: CreateUserParams): Promise<UserEntity> {
    const result: QueryResult<UserRow> = await this.pool.query(
      `INSERT INTO users (login_id, password_hash, role, display_name, must_change_password)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [params.loginId, params.passwordHash, params.role, params.displayName, params.mustChangePassword],
    );
    return toEntity(result.rows[0]);
  }

  async byLoginIdActive(loginId: string): Promise<UserEntity | null> {
    const result: QueryResult<UserRow> = await this.pool.query(
      `SELECT * FROM users WHERE login_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [loginId],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async byId(id: string): Promise<UserEntity | null> {
    const result: QueryResult<UserRow> = await this.pool.query(
      `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async updatePasswordAndFlag(id: string, passwordHash: string, mustChangePassword: boolean): Promise<UserEntity | null> {
    const result: QueryResult<UserRow> = await this.pool.query(
      `UPDATE users
       SET password_hash = $2, must_change_password = $3, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, passwordHash, mustChangePassword],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.pool.query(`UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
  }

  async listCandidates(offset: number, limit: number): Promise<{ items: UserEntity[]; total: number }> {
    const countResult: QueryResult<{ count: string }> = await this.pool.query(
      `SELECT COUNT(*) AS count FROM users WHERE role = $1 AND deleted_at IS NULL`,
      [UserRole.CANDIDATE],
    );
    const total = Number(countResult.rows[0].count);

    const result: QueryResult<UserRow> = await this.pool.query(
      `SELECT * FROM users
       WHERE role = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [UserRole.CANDIDATE, limit, offset],
    );

    return { items: result.rows.map(toEntity), total };
  }
}
