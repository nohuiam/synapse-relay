/**
 * Tool: relay_signal
 *
 * Relay a signal to one or more target servers.
 */
import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { RelaySignalOutput } from '../types.js';
export declare const RELAY_SIGNAL_SCHEMA: z.ZodObject<{
    signal_type: z.ZodNumber;
    target_servers: z.ZodArray<z.ZodString, "many">;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    priority: z.ZodDefault<z.ZodOptional<z.ZodEnum<["low", "normal", "high", "urgent"]>>>;
    retry_on_fail: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    buffer_if_offline: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    signal_type: number;
    priority: "low" | "normal" | "high" | "urgent";
    target_servers: string[];
    payload: Record<string, unknown>;
    retry_on_fail: boolean;
    buffer_if_offline: boolean;
}, {
    signal_type: number;
    target_servers: string[];
    payload: Record<string, unknown>;
    priority?: "low" | "normal" | "high" | "urgent" | undefined;
    retry_on_fail?: boolean | undefined;
    buffer_if_offline?: boolean | undefined;
}>;
export type RelaySignalInput = z.infer<typeof RELAY_SIGNAL_SCHEMA>;
export declare const RELAY_SIGNAL_TOOL: Tool;
export declare function handleRelaySignal(args: unknown): Promise<RelaySignalOutput>;
//# sourceMappingURL=relay-signal.d.ts.map