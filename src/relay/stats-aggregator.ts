/**
 * Stats Aggregator
 *
 * Collects and aggregates relay statistics hourly.
 */

import { getDatabase } from '../database/schema.js';
import type { GroupByOption, GroupStats, DbRelayStats } from '../types.js';

let aggregationInterval: NodeJS.Timeout | null = null;

/**
 * Start the stats aggregation interval
 */
export function startStatsAggregation(intervalMs: number = 3600000): void {
  if (aggregationInterval) {
    clearInterval(aggregationInterval);
  }

  // Run aggregation immediately
  aggregateHourlyStats();

  // Schedule periodic aggregation
  aggregationInterval = setInterval(() => {
    aggregateHourlyStats();
  }, intervalMs);

  console.error(`[synapse-relay] Stats aggregation started (interval: ${intervalMs}ms)`);
}

/**
 * Stop the stats aggregation interval
 */
export function stopStatsAggregation(): void {
  if (aggregationInterval) {
    clearInterval(aggregationInterval);
    aggregationInterval = null;
    console.error('[synapse-relay] Stats aggregation stopped');
  }
}

/**
 * Aggregate stats for the last hour
 */
export function aggregateHourlyStats(): void {
  const db = getDatabase();
  const now = Date.now();
  const hourAgo = now - (60 * 60 * 1000);

  // Round to hour boundaries
  const periodStart = Math.floor(hourAgo / (60 * 60 * 1000)) * (60 * 60 * 1000);

  const relays = db.getSignalRelayHistory(periodStart, 10000);

  if (relays.length === 0) {
    return;
  }

  // Aggregate by signal type, source, and target
  const aggregations = new Map<string, {
    signal_type: number | null;
    source_server: string | null;
    target_server: string | null;
    total_relayed: number;
    success_count: number;
    failure_count: number;
    latencies: number[];
    buffered_count: number;
  }>();

  for (const relay of relays) {
    const targets = JSON.parse(relay.target_servers) as string[];
    const reached = relay.targets_reached ? JSON.parse(relay.targets_reached) as string[] : [];
    const failed = relay.targets_failed ? JSON.parse(relay.targets_failed) as string[] : [];

    for (const target of targets) {
      const key = `${relay.signal_type}:${relay.source_server}:${target}`;

      if (!aggregations.has(key)) {
        aggregations.set(key, {
          signal_type: relay.signal_type,
          source_server: relay.source_server,
          target_server: target,
          total_relayed: 0,
          success_count: 0,
          failure_count: 0,
          latencies: [],
          buffered_count: 0
        });
      }

      const agg = aggregations.get(key)!;
      agg.total_relayed++;

      if (reached.includes(target)) {
        agg.success_count++;
      }
      if (failed.includes(target)) {
        agg.failure_count++;
      }
      if (relay.latency_ms !== null) {
        agg.latencies.push(relay.latency_ms);
      }
    }
  }

  // Store aggregations
  for (const agg of aggregations.values()) {
    const avgLatency = agg.latencies.length > 0
      ? agg.latencies.reduce((a, b) => a + b, 0) / agg.latencies.length
      : null;
    const maxLatency = agg.latencies.length > 0
      ? Math.max(...agg.latencies)
      : null;

    db.insertRelayStats({
      period_start: periodStart,
      signal_type: agg.signal_type,
      source_server: agg.source_server,
      target_server: agg.target_server,
      total_relayed: agg.total_relayed,
      success_count: agg.success_count,
      failure_count: agg.failure_count,
      avg_latency_ms: avgLatency,
      max_latency_ms: maxLatency,
      buffered_count: agg.buffered_count
    });
  }

  console.error(`[synapse-relay] Aggregated stats for ${relays.length} relays`);
}

/**
 * Get relay statistics
 */
export function getRelayStatistics(
  since: number,
  until?: number,
  groupBy?: GroupByOption,
  includeFailures: boolean = true
): {
  total_relayed: number;
  success_rate: number;
  avg_latency_ms: number;
  by_group: Record<string, GroupStats>;
  buffer_stats: { pending: number; delivered: number; expired: number };
} {
  const db = getDatabase();
  const stats = db.getRelayStats(since, until);
  const bufferStats = db.getBufferStats();

  let totalRelayed = 0;
  let totalSuccess = 0;
  let totalLatency = 0;
  let latencyCount = 0;

  const byGroup: Record<string, { count: number; success: number; latencies: number[] }> = {};

  for (const stat of stats) {
    totalRelayed += stat.total_relayed;
    totalSuccess += stat.success_count;

    if (stat.avg_latency_ms !== null) {
      totalLatency += stat.avg_latency_ms * stat.total_relayed;
      latencyCount += stat.total_relayed;
    }

    // Group by requested dimension
    let groupKey: string | null = null;
    switch (groupBy) {
      case 'signal_type':
        groupKey = stat.signal_type !== null ? `signal_${stat.signal_type}` : 'unknown';
        break;
      case 'source':
        groupKey = stat.source_server || 'unknown';
        break;
      case 'target':
        groupKey = stat.target_server || 'unknown';
        break;
      case 'hour':
        groupKey = new Date(stat.period_start).toISOString().substring(0, 13);
        break;
      case 'day':
        groupKey = new Date(stat.period_start).toISOString().substring(0, 10);
        break;
    }

    if (groupKey) {
      if (!byGroup[groupKey]) {
        byGroup[groupKey] = { count: 0, success: 0, latencies: [] };
      }
      byGroup[groupKey].count += stat.total_relayed;
      byGroup[groupKey].success += stat.success_count;
      if (stat.avg_latency_ms !== null) {
        byGroup[groupKey].latencies.push(stat.avg_latency_ms);
      }
    }
  }

  // Convert grouped data to output format
  const byGroupOutput: Record<string, GroupStats> = {};
  for (const [key, data] of Object.entries(byGroup)) {
    byGroupOutput[key] = {
      count: data.count,
      success_rate: data.count > 0 ? (data.success / data.count) * 100 : 0,
      avg_latency: data.latencies.length > 0
        ? data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length
        : 0
    };
  }

  return {
    total_relayed: totalRelayed,
    success_rate: totalRelayed > 0 ? (totalSuccess / totalRelayed) * 100 : 0,
    avg_latency_ms: latencyCount > 0 ? totalLatency / latencyCount : 0,
    by_group: byGroupOutput,
    buffer_stats: {
      pending: bufferStats.pending,
      delivered: bufferStats.delivered,
      expired: bufferStats.expired
    }
  };
}

/**
 * Cleanup old stats data
 */
export function cleanupOldStats(retentionDays: number): void {
  const db = getDatabase();
  db.cleanupOldData(retentionDays);
}
