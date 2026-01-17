/**
 * Database Schema for Synapse Relay
 *
 * Tables:
 * - signal_relays: Signal relay history
 * - relay_rules: Automatic relay rules
 * - signal_buffer: Buffered signals for offline targets
 * - relay_stats: Aggregated relay statistics
 */

import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import type {
  DbSignalRelay,
  DbRelayRule,
  DbSignalBuffer,
  DbRelayStats,
  SignalPriority,
  BufferStatus
} from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const finalPath = dbPath || join(__dirname, '..', '..', 'data', 'synapse-relay.db');

    const dbDir = dirname(finalPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(finalPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('cache_size = 2000');
    this.initializeSchema();
  }

  private initializeSchema(): void {
    const schema = `
      -- Signal Relay History
      CREATE TABLE IF NOT EXISTS signal_relays (
        id TEXT PRIMARY KEY,
        signal_type INTEGER NOT NULL,
        source_server TEXT NOT NULL,
        target_servers TEXT NOT NULL,
        payload TEXT NOT NULL,
        priority TEXT DEFAULT 'normal',
        relayed_at INTEGER NOT NULL,
        success INTEGER DEFAULT 1,
        targets_reached TEXT,
        targets_failed TEXT,
        latency_ms INTEGER,
        error_message TEXT
      );

      -- Automatic Relay Rules
      CREATE TABLE IF NOT EXISTS relay_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        signal_pattern INTEGER NOT NULL,
        source_filter TEXT,
        relay_to TEXT NOT NULL,
        transform TEXT,
        priority INTEGER DEFAULT 0,
        enabled INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER,
        match_count INTEGER DEFAULT 0
      );

      -- Signal Buffer (for offline targets)
      CREATE TABLE IF NOT EXISTS signal_buffer (
        id TEXT PRIMARY KEY,
        signal_type INTEGER NOT NULL,
        source_server TEXT NOT NULL,
        target_server TEXT NOT NULL,
        payload TEXT NOT NULL,
        priority TEXT DEFAULT 'normal',
        buffered_at INTEGER NOT NULL,
        retry_count INTEGER DEFAULT 0,
        last_retry_at INTEGER,
        max_retries INTEGER DEFAULT 3,
        expires_at INTEGER,
        status TEXT DEFAULT 'pending'
      );

      -- Relay Statistics (aggregated hourly)
      CREATE TABLE IF NOT EXISTS relay_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period_start INTEGER NOT NULL,
        signal_type INTEGER,
        source_server TEXT,
        target_server TEXT,
        total_relayed INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        avg_latency_ms REAL,
        max_latency_ms INTEGER,
        buffered_count INTEGER DEFAULT 0
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_relays_time ON signal_relays(relayed_at);
      CREATE INDEX IF NOT EXISTS idx_relays_signal ON signal_relays(signal_type);
      CREATE INDEX IF NOT EXISTS idx_buffer_target ON signal_buffer(target_server);
      CREATE INDEX IF NOT EXISTS idx_buffer_status ON signal_buffer(status);
      CREATE INDEX IF NOT EXISTS idx_buffer_expires ON signal_buffer(expires_at);
      CREATE INDEX IF NOT EXISTS idx_rules_pattern ON relay_rules(signal_pattern);
      CREATE INDEX IF NOT EXISTS idx_rules_enabled ON relay_rules(enabled);
      CREATE INDEX IF NOT EXISTS idx_stats_period ON relay_stats(period_start);
    `;

    this.db.exec(schema);
  }

  // Signal Relays CRUD
  insertSignalRelay(relay: DbSignalRelay): void {
    const stmt = this.db.prepare(`
      INSERT INTO signal_relays (
        id, signal_type, source_server, target_servers, payload, priority,
        relayed_at, success, targets_reached, targets_failed, latency_ms, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      relay.id,
      relay.signal_type,
      relay.source_server,
      relay.target_servers,
      relay.payload,
      relay.priority,
      relay.relayed_at,
      relay.success,
      relay.targets_reached,
      relay.targets_failed,
      relay.latency_ms,
      relay.error_message
    );
  }

  getSignalRelay(id: string): DbSignalRelay | undefined {
    const stmt = this.db.prepare('SELECT * FROM signal_relays WHERE id = ?');
    return stmt.get(id) as DbSignalRelay | undefined;
  }

  getSignalRelayHistory(since: number, limit: number = 100): DbSignalRelay[] {
    const stmt = this.db.prepare('SELECT * FROM signal_relays WHERE relayed_at >= ? ORDER BY relayed_at DESC LIMIT ?');
    return stmt.all(since, limit) as DbSignalRelay[];
  }

  // Relay Rules CRUD
  insertRelayRule(rule: Omit<DbRelayRule, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO relay_rules (
        signal_pattern, source_filter, relay_to, transform, priority,
        enabled, created_at, updated_at, match_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      rule.signal_pattern,
      rule.source_filter,
      rule.relay_to,
      rule.transform,
      rule.priority,
      rule.enabled,
      rule.created_at,
      rule.updated_at,
      rule.match_count
    );
    return result.lastInsertRowid as number;
  }

  getRelayRule(id: number): DbRelayRule | undefined {
    const stmt = this.db.prepare('SELECT * FROM relay_rules WHERE id = ?');
    return stmt.get(id) as DbRelayRule | undefined;
  }

  getEnabledRelayRules(): DbRelayRule[] {
    const stmt = this.db.prepare('SELECT * FROM relay_rules WHERE enabled = 1 ORDER BY priority DESC');
    return stmt.all() as DbRelayRule[];
  }

  getAllRelayRules(): DbRelayRule[] {
    const stmt = this.db.prepare('SELECT * FROM relay_rules ORDER BY priority DESC');
    return stmt.all() as DbRelayRule[];
  }

  updateRelayRule(id: number, updates: Partial<DbRelayRule>): boolean {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.signal_pattern !== undefined) {
      fields.push('signal_pattern = ?');
      values.push(updates.signal_pattern);
    }
    if (updates.source_filter !== undefined) {
      fields.push('source_filter = ?');
      values.push(updates.source_filter);
    }
    if (updates.relay_to !== undefined) {
      fields.push('relay_to = ?');
      values.push(updates.relay_to);
    }
    if (updates.transform !== undefined) {
      fields.push('transform = ?');
      values.push(updates.transform);
    }
    if (updates.priority !== undefined) {
      fields.push('priority = ?');
      values.push(updates.priority);
    }
    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(updates.enabled);
    }

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = this.db.prepare(`UPDATE relay_rules SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  deleteRelayRule(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM relay_rules WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  incrementRuleMatchCount(id: number): void {
    const stmt = this.db.prepare('UPDATE relay_rules SET match_count = match_count + 1 WHERE id = ?');
    stmt.run(id);
  }

  // Signal Buffer CRUD
  insertBufferedSignal(buffer: DbSignalBuffer): void {
    const stmt = this.db.prepare(`
      INSERT INTO signal_buffer (
        id, signal_type, source_server, target_server, payload, priority,
        buffered_at, retry_count, last_retry_at, max_retries, expires_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      buffer.id,
      buffer.signal_type,
      buffer.source_server,
      buffer.target_server,
      buffer.payload,
      buffer.priority,
      buffer.buffered_at,
      buffer.retry_count,
      buffer.last_retry_at,
      buffer.max_retries,
      buffer.expires_at,
      buffer.status
    );
  }

  getBufferedSignal(id: string): DbSignalBuffer | undefined {
    const stmt = this.db.prepare('SELECT * FROM signal_buffer WHERE id = ?');
    return stmt.get(id) as DbSignalBuffer | undefined;
  }

  getPendingBufferedSignals(targetServer?: string): DbSignalBuffer[] {
    let query = 'SELECT * FROM signal_buffer WHERE status = ?';
    const params: unknown[] = ['pending'];

    if (targetServer) {
      query += ' AND target_server = ?';
      params.push(targetServer);
    }

    query += ' ORDER BY buffered_at ASC';
    const stmt = this.db.prepare(query);
    return stmt.all(...params) as DbSignalBuffer[];
  }

  getRetryableBufferedSignals(retryAfter: number): DbSignalBuffer[] {
    const stmt = this.db.prepare(`
      SELECT * FROM signal_buffer
      WHERE status = 'pending'
      AND (last_retry_at IS NULL OR last_retry_at < ?)
      AND retry_count < max_retries
      AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY priority DESC, buffered_at ASC
    `);
    return stmt.all(retryAfter, Date.now()) as DbSignalBuffer[];
  }

  updateBufferedSignalStatus(id: string, status: BufferStatus): boolean {
    const stmt = this.db.prepare('UPDATE signal_buffer SET status = ? WHERE id = ?');
    const result = stmt.run(status, id);
    return result.changes > 0;
  }

  incrementBufferRetryCount(id: string): void {
    const stmt = this.db.prepare('UPDATE signal_buffer SET retry_count = retry_count + 1, last_retry_at = ? WHERE id = ?');
    stmt.run(Date.now(), id);
  }

  deleteBufferedSignal(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM signal_buffer WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  deleteBufferedSignalsByTarget(targetServer: string): number {
    const stmt = this.db.prepare('DELETE FROM signal_buffer WHERE target_server = ?');
    const result = stmt.run(targetServer);
    return result.changes;
  }

  getBufferStats(): { pending: number; delivered: number; expired: number; failed: number } {
    const pending = (this.db.prepare("SELECT COUNT(*) as count FROM signal_buffer WHERE status = 'pending'").get() as { count: number }).count;
    const delivered = (this.db.prepare("SELECT COUNT(*) as count FROM signal_buffer WHERE status = 'delivered'").get() as { count: number }).count;
    const expired = (this.db.prepare("SELECT COUNT(*) as count FROM signal_buffer WHERE status = 'expired'").get() as { count: number }).count;
    const failed = (this.db.prepare("SELECT COUNT(*) as count FROM signal_buffer WHERE status = 'failed'").get() as { count: number }).count;

    return { pending, delivered, expired, failed };
  }

  expireOldBufferedSignals(): number {
    const stmt = this.db.prepare("UPDATE signal_buffer SET status = 'expired' WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < ?");
    const result = stmt.run(Date.now());
    return result.changes;
  }

  // Relay Stats CRUD
  insertRelayStats(stats: Omit<DbRelayStats, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO relay_stats (
        period_start, signal_type, source_server, target_server,
        total_relayed, success_count, failure_count, avg_latency_ms, max_latency_ms, buffered_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      stats.period_start,
      stats.signal_type,
      stats.source_server,
      stats.target_server,
      stats.total_relayed,
      stats.success_count,
      stats.failure_count,
      stats.avg_latency_ms,
      stats.max_latency_ms,
      stats.buffered_count
    );
    return result.lastInsertRowid as number;
  }

  getRelayStats(since: number, until?: number): DbRelayStats[] {
    let query = 'SELECT * FROM relay_stats WHERE period_start >= ?';
    const params: unknown[] = [since];

    if (until) {
      query += ' AND period_start <= ?';
      params.push(until);
    }

    query += ' ORDER BY period_start DESC';
    const stmt = this.db.prepare(query);
    return stmt.all(...params) as DbRelayStats[];
  }

  getAggregatedStats(since: number, until?: number): {
    total_relayed: number;
    success_count: number;
    failure_count: number;
    avg_latency_ms: number | null;
    buffered_count: number;
  } {
    let query = `
      SELECT
        SUM(total_relayed) as total_relayed,
        SUM(success_count) as success_count,
        SUM(failure_count) as failure_count,
        AVG(avg_latency_ms) as avg_latency_ms,
        SUM(buffered_count) as buffered_count
      FROM relay_stats WHERE period_start >= ?
    `;
    const params: unknown[] = [since];

    if (until) {
      query += ' AND period_start <= ?';
      params.push(until);
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as {
      total_relayed: number | null;
      success_count: number | null;
      failure_count: number | null;
      avg_latency_ms: number | null;
      buffered_count: number | null;
    };

    return {
      total_relayed: result.total_relayed ?? 0,
      success_count: result.success_count ?? 0,
      failure_count: result.failure_count ?? 0,
      avg_latency_ms: result.avg_latency_ms,
      buffered_count: result.buffered_count ?? 0
    };
  }

  // Cleanup
  cleanupOldData(retentionDays: number): void {
    const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    this.db.prepare('DELETE FROM signal_relays WHERE relayed_at < ?').run(cutoff);
    this.db.prepare('DELETE FROM relay_stats WHERE period_start < ?').run(cutoff);
    this.db.prepare("DELETE FROM signal_buffer WHERE status != 'pending' AND buffered_at < ?").run(cutoff);
  }

  // Stats
  getStats(): {
    total_relays: number;
    total_rules: number;
    buffer_size: number;
    stats_entries: number;
  } {
    const totalRelays = (this.db.prepare('SELECT COUNT(*) as count FROM signal_relays').get() as { count: number }).count;
    const totalRules = (this.db.prepare('SELECT COUNT(*) as count FROM relay_rules').get() as { count: number }).count;
    const bufferSize = (this.db.prepare('SELECT COUNT(*) as count FROM signal_buffer WHERE status = ?').get('pending') as { count: number }).count;
    const statsEntries = (this.db.prepare('SELECT COUNT(*) as count FROM relay_stats').get() as { count: number }).count;

    return {
      total_relays: totalRelays,
      total_rules: totalRules,
      buffer_size: bufferSize,
      stats_entries: statsEntries
    };
  }

  close(): void {
    this.db.close();
  }
}

// Singleton instance
let dbInstance: DatabaseManager | null = null;

export function getDatabase(): DatabaseManager {
  if (!dbInstance) {
    dbInstance = new DatabaseManager();
  }
  return dbInstance;
}

export function initDatabase(): DatabaseManager {
  if (!dbInstance) {
    dbInstance = new DatabaseManager();
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
