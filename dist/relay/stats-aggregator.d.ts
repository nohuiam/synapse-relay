/**
 * Stats Aggregator
 *
 * Collects and aggregates relay statistics hourly.
 */
import type { GroupByOption, GroupStats } from '../types.js';
/**
 * Start the stats aggregation interval
 */
export declare function startStatsAggregation(intervalMs?: number): void;
/**
 * Stop the stats aggregation interval
 */
export declare function stopStatsAggregation(): void;
/**
 * Aggregate stats for the last hour
 */
export declare function aggregateHourlyStats(): void;
/**
 * Get relay statistics
 */
export declare function getRelayStatistics(since: number, until?: number, groupBy?: GroupByOption, includeFailures?: boolean): {
    total_relayed: number;
    success_rate: number;
    avg_latency_ms: number;
    by_group: Record<string, GroupStats>;
    buffer_stats: {
        pending: number;
        delivered: number;
        expired: number;
    };
};
/**
 * Cleanup old stats data
 */
export declare function cleanupOldStats(retentionDays: number): void;
//# sourceMappingURL=stats-aggregator.d.ts.map