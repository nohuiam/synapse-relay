/**
 * Tool: buffer_signals
 *
 * Manage buffered signals for offline targets.
 */
import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { BufferSignalsOutput } from '../types.js';
export declare const BUFFER_SIGNALS_SCHEMA: z.ZodObject<{
    action: z.ZodEnum<["list", "retry", "clear", "flush"]>;
    target_server: z.ZodOptional<z.ZodString>;
    signal_type: z.ZodOptional<z.ZodNumber>;
    max_age_hours: z.ZodOptional<z.ZodNumber>;
    buffer_ids: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    action: "list" | "retry" | "clear" | "flush";
    signal_type?: number | undefined;
    target_server?: string | undefined;
    max_age_hours?: number | undefined;
    buffer_ids?: string[] | undefined;
}, {
    action: "list" | "retry" | "clear" | "flush";
    signal_type?: number | undefined;
    target_server?: string | undefined;
    max_age_hours?: number | undefined;
    buffer_ids?: string[] | undefined;
}>;
export type BufferSignalsInput = z.infer<typeof BUFFER_SIGNALS_SCHEMA>;
export declare const BUFFER_SIGNALS_TOOL: Tool;
export declare function handleBufferSignals(args: unknown): Promise<BufferSignalsOutput>;
//# sourceMappingURL=buffer-signals.d.ts.map