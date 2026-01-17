/**
 * Tool: configure_relay
 *
 * Configure automatic relay rules for signal routing.
 */
import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ConfigureRelayOutput } from '../types.js';
export declare const CONFIGURE_RELAY_SCHEMA: z.ZodObject<{
    action: z.ZodEnum<["add", "update", "remove", "list"]>;
    rule_id: z.ZodOptional<z.ZodNumber>;
    signal_pattern: z.ZodOptional<z.ZodNumber>;
    source_filter: z.ZodOptional<z.ZodString>;
    relay_to: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    transform: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    enabled: z.ZodOptional<z.ZodBoolean>;
    priority: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    action: "add" | "update" | "remove" | "list";
    signal_pattern?: number | undefined;
    source_filter?: string | undefined;
    relay_to?: string[] | undefined;
    transform?: Record<string, unknown> | undefined;
    priority?: number | undefined;
    enabled?: boolean | undefined;
    rule_id?: number | undefined;
}, {
    action: "add" | "update" | "remove" | "list";
    signal_pattern?: number | undefined;
    source_filter?: string | undefined;
    relay_to?: string[] | undefined;
    transform?: Record<string, unknown> | undefined;
    priority?: number | undefined;
    enabled?: boolean | undefined;
    rule_id?: number | undefined;
}>;
export type ConfigureRelayInput = z.infer<typeof CONFIGURE_RELAY_SCHEMA>;
export declare const CONFIGURE_RELAY_TOOL: Tool;
export declare function handleConfigureRelay(args: unknown): ConfigureRelayOutput;
//# sourceMappingURL=configure-relay.d.ts.map