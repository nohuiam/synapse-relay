/**
 * Tool: get_relay_stats
 *
 * Get relay statistics and performance metrics.
 */
import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { GetRelayStatsOutput } from '../types.js';
export declare const GET_RELAY_STATS_SCHEMA: z.ZodObject<{
    since: z.ZodOptional<z.ZodNumber>;
    until: z.ZodOptional<z.ZodNumber>;
    group_by: z.ZodOptional<z.ZodEnum<["signal_type", "source", "target", "hour", "day"]>>;
    include_failures: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    include_failures: boolean;
    since?: number | undefined;
    until?: number | undefined;
    group_by?: "signal_type" | "source" | "target" | "hour" | "day" | undefined;
}, {
    since?: number | undefined;
    until?: number | undefined;
    group_by?: "signal_type" | "source" | "target" | "hour" | "day" | undefined;
    include_failures?: boolean | undefined;
}>;
export type GetRelayStatsInput = z.infer<typeof GET_RELAY_STATS_SCHEMA>;
export declare const GET_RELAY_STATS_TOOL: Tool;
export declare function handleGetRelayStats(args: unknown): GetRelayStatsOutput;
//# sourceMappingURL=get-relay-stats.d.ts.map