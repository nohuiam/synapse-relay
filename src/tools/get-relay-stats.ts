/**
 * Tool: get_relay_stats
 *
 * Get relay statistics and performance metrics.
 */

import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getRelayStatistics } from '../relay/stats-aggregator.js';
import type { GetRelayStatsOutput } from '../types.js';

export const GET_RELAY_STATS_SCHEMA = z.object({
  since: z.number().optional().describe('Unix timestamp to start from'),
  until: z.number().optional().describe('Unix timestamp to end at'),
  group_by: z.enum(['signal_type', 'source', 'target', 'hour', 'day']).optional().describe('Group results by'),
  include_failures: z.boolean().optional().default(true).describe('Include failure stats')
});

export type GetRelayStatsInput = z.infer<typeof GET_RELAY_STATS_SCHEMA>;

export const GET_RELAY_STATS_TOOL: Tool = {
  name: 'get_relay_stats',
  description: 'Get relay statistics and performance metrics including success rates, latencies, and buffer status.',
  inputSchema: {
    type: 'object',
    properties: {
      since: {
        type: 'number',
        description: 'Unix timestamp to start from'
      },
      until: {
        type: 'number',
        description: 'Unix timestamp to end at'
      },
      group_by: {
        type: 'string',
        enum: ['signal_type', 'source', 'target', 'hour', 'day'],
        description: 'Group results by dimension'
      },
      include_failures: {
        type: 'boolean',
        description: 'Include failure stats (default: true)'
      }
    }
  }
};

export function handleGetRelayStats(args: unknown): GetRelayStatsOutput {
  const input = GET_RELAY_STATS_SCHEMA.parse(args || {});

  // Default to last 24 hours if no time range specified
  const since = input.since ?? Date.now() - (24 * 60 * 60 * 1000);
  const until = input.until;

  const stats = getRelayStatistics(
    since,
    until,
    input.group_by,
    input.include_failures ?? true
  );

  return {
    total_relayed: stats.total_relayed,
    success_rate: Math.round(stats.success_rate * 100) / 100,
    avg_latency_ms: Math.round(stats.avg_latency_ms * 100) / 100,
    by_group: stats.by_group,
    buffer_stats: stats.buffer_stats
  };
}
