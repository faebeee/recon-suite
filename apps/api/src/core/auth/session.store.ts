import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import {
  AuthenticationStorage,
  type SessionRecord,
  type SessionStore,
} from '@nestjs/authentication';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { Db } from '../db/database.js';
import { sessions } from '../db/schema.js';

type Row = typeof sessions.$inferSelect;

/** Persists login sessions in SQLite so they survive restarts. */
@Injectable()
export class SqliteSessionStore implements SessionStore {
  constructor(
    @InjectDrizzle() private readonly db: Db,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ sessions: this });
  }

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id));
    return row ? toRecord(row) : undefined;
  }

  async createSession(r: SessionRecord): Promise<void> {
    // Opportunistic cleanup keeps the table small without a scheduler.
    await this.db.delete(sessions).where(lt(sessions.expiresAt, Date.now()));
    await this.db.insert(sessions).values({
      id: r.id,
      userId: r.userId,
      createdAt: r.createdAt.getTime(),
      expiresAt: r.expiresAt.getTime(),
      lastActiveAt: r.lastActiveAt.getTime(),
      mfa: r.mfa ?? null,
      metadata: r.metadata ? JSON.stringify(r.metadata) : null,
    });
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    await this.db
      .update(sessions)
      .set({ lastActiveAt: lastActiveAt.getTime() })
      .where(and(eq(sessions.id, id), gt(sessions.expiresAt, Date.now())));
  }

  async deleteSession(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(sessions)
      .where(eq(sessions.id, id))
      .returning({ id: sessions.id });
    return deleted.length > 0;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    const rows = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId));
    return rows.map(toRecord);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }
}

function toRecord(row: Row): SessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    createdAt: new Date(row.createdAt),
    expiresAt: new Date(row.expiresAt),
    lastActiveAt: new Date(row.lastActiveAt),
    ...(row.mfa && { mfa: row.mfa }),
    ...(row.metadata && {
      metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    }),
  };
}
