import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient, QueryResult } from 'pg';
import { PG_POOL } from '../database/database.providers';
import { ExtensionRequestEntity, ExtensionRequestStatus } from './entities/extension-request.entity';

interface ExtensionRequestRow {
  id: string;
  attempt_id: string;
  requested_seconds: number | null;
  status: string;
  granted_seconds: number | null;
  admin_note: string | null;
  resolved_by: string | null;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
}

function toEntity(row: ExtensionRequestRow): ExtensionRequestEntity {
  return {
    id: row.id,
    attemptId: row.attempt_id,
    requestedSeconds: row.requested_seconds,
    status: row.status as ExtensionRequestStatus,
    grantedSeconds: row.granted_seconds,
    adminNote: row.admin_note,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

// Postgres error code for a unique constraint violation - used to translate a
// race on the "one pending request per attempt" partial unique index into a
// clean AppException instead of a raw 500.
export const UNIQUE_VIOLATION_ERROR_CODE = '23505';

export interface PgUniqueViolationError {
  code: string;
}

export function isUniqueViolation(err: unknown): err is PgUniqueViolationError {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === UNIQUE_VIOLATION_ERROR_CODE;
}

// Postgres error code for a CHECK constraint violation - used as a defense-in-depth
// catch around the 7200s cap on test_attempts, in case the app-level pre-check in
// ExtensionRequestService.approve() misses a case.
export const CHECK_VIOLATION_ERROR_CODE = '23514';

export function isCheckViolation(err: unknown): err is PgUniqueViolationError {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === CHECK_VIOLATION_ERROR_CODE;
}

@Injectable()
export class ExtensionRequestsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(
    attemptId: string,
    requestedSeconds: number | null,
    client?: PoolClient,
  ): Promise<ExtensionRequestEntity> {
    const executor = client ?? this.pool;
    const result: QueryResult<ExtensionRequestRow> = await executor.query(
      `INSERT INTO extension_requests (attempt_id, requested_seconds, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [attemptId, requestedSeconds, ExtensionRequestStatus.PENDING],
    );
    return toEntity(result.rows[0]);
  }

  async byId(id: string): Promise<ExtensionRequestEntity | null> {
    const result: QueryResult<ExtensionRequestRow> = await this.pool.query(
      `SELECT * FROM extension_requests WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async pendingForAttempt(attemptId: string): Promise<ExtensionRequestEntity | null> {
    const result: QueryResult<ExtensionRequestRow> = await this.pool.query(
      `SELECT * FROM extension_requests
       WHERE attempt_id = $1 AND status = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [attemptId, ExtensionRequestStatus.PENDING],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async list(
    status: ExtensionRequestStatus | undefined,
    offset: number,
    limit: number,
  ): Promise<{ items: ExtensionRequestEntity[]; total: number }> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const values: unknown[] = [];

    if (status) {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }

    const whereClause = conditions.join(' AND ');

    const countResult: QueryResult<{ count: string }> = await this.pool.query(
      `SELECT COUNT(*) AS count FROM extension_requests WHERE ${whereClause}`,
      values,
    );
    const total = Number(countResult.rows[0].count);

    values.push(limit);
    const limitIndex = values.length;
    values.push(offset);
    const offsetIndex = values.length;

    const result: QueryResult<ExtensionRequestRow> = await this.pool.query(
      `SELECT * FROM extension_requests
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values,
    );

    return { items: result.rows.map(toEntity), total };
  }

  async markApproved(
    id: string,
    grantedSeconds: number,
    resolvedBy: string,
    client?: PoolClient,
  ): Promise<ExtensionRequestEntity | null> {
    const executor = client ?? this.pool;
    const result: QueryResult<ExtensionRequestRow> = await executor.query(
      `UPDATE extension_requests
       SET status = $2, granted_seconds = $3, resolved_by = $4, resolved_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, ExtensionRequestStatus.APPROVED, grantedSeconds, resolvedBy],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async markDenied(id: string, adminNote: string | null, resolvedBy: string): Promise<ExtensionRequestEntity | null> {
    const result: QueryResult<ExtensionRequestRow> = await this.pool.query(
      `UPDATE extension_requests
       SET status = $2, admin_note = $3, resolved_by = $4, resolved_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, ExtensionRequestStatus.DENIED, adminNote, resolvedBy],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }
}
