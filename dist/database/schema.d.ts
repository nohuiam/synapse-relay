/**
 * Database Schema for Synapse Relay
 *
 * Tables:
 * - signal_relays: Signal relay history
 * - relay_rules: Automatic relay rules
 * - signal_buffer: Buffered signals for offline targets
 * - relay_stats: Aggregated relay statistics
 */
import type { DbSignalRelay, DbRelayRule, DbSignalBuffer, DbRelayStats, BufferStatus } from '../types.js';
export declare class DatabaseManager {
    private db;
    constructor(dbPath?: string);
    private initializeSchema;
    insertSignalRelay(relay: DbSignalRelay): void;
    getSignalRelay(id: string): DbSignalRelay | undefined;
    getSignalRelayHistory(since: number, limit?: number): DbSignalRelay[];
    insertRelayRule(rule: Omit<DbRelayRule, 'id'>): number;
    getRelayRule(id: number): DbRelayRule | undefined;
    getEnabledRelayRules(): DbRelayRule[];
    getAllRelayRules(): DbRelayRule[];
    updateRelayRule(id: number, updates: Partial<DbRelayRule>): boolean;
    deleteRelayRule(id: number): boolean;
    incrementRuleMatchCount(id: number): void;
    insertBufferedSignal(buffer: DbSignalBuffer): void;
    getBufferedSignal(id: string): DbSignalBuffer | undefined;
    getPendingBufferedSignals(targetServer?: string): DbSignalBuffer[];
    getRetryableBufferedSignals(retryAfter: number): DbSignalBuffer[];
    updateBufferedSignalStatus(id: string, status: BufferStatus): boolean;
    incrementBufferRetryCount(id: string): void;
    deleteBufferedSignal(id: string): boolean;
    deleteBufferedSignalsByTarget(targetServer: string): number;
    getBufferStats(): {
        pending: number;
        delivered: number;
        expired: number;
        failed: number;
    };
    expireOldBufferedSignals(): number;
    insertRelayStats(stats: Omit<DbRelayStats, 'id'>): number;
    getRelayStats(since: number, until?: number): DbRelayStats[];
    getAggregatedStats(since: number, until?: number): {
        total_relayed: number;
        success_count: number;
        failure_count: number;
        avg_latency_ms: number | null;
        buffered_count: number;
    };
    cleanupOldData(retentionDays: number): void;
    getStats(): {
        total_relays: number;
        total_rules: number;
        buffer_size: number;
        stats_entries: number;
    };
    close(): void;
}
export declare function getDatabase(): DatabaseManager;
export declare function initDatabase(): DatabaseManager;
export declare function closeDatabase(): void;
//# sourceMappingURL=schema.d.ts.map