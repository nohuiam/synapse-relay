/**
 * Rule Engine
 *
 * Pattern matching and automatic routing for signals.
 */
import type { DbRelayRule, RelayRule } from '../types.js';
/**
 * Match rules for a signal
 */
export declare function matchRules(signalType: number, sourceServer: string): DbRelayRule[];
/**
 * Apply transformation to payload
 */
export declare function applyTransform(payload: Record<string, unknown>, transform: Record<string, unknown>): Record<string, unknown>;
/**
 * Add a new relay rule
 */
export declare function addRule(signalPattern: number, relayTo: string[], options?: {
    sourceFilter?: string;
    transform?: Record<string, unknown>;
    priority?: number;
    enabled?: boolean;
}): number;
/**
 * Update an existing rule
 */
export declare function updateRule(ruleId: number, updates: {
    signalPattern?: number;
    sourceFilter?: string | null;
    relayTo?: string[];
    transform?: Record<string, unknown> | null;
    priority?: number;
    enabled?: boolean;
}): boolean;
/**
 * Remove a rule
 */
export declare function removeRule(ruleId: number): boolean;
/**
 * List all rules
 */
export declare function listRules(): RelayRule[];
/**
 * Get a specific rule
 */
export declare function getRule(ruleId: number): RelayRule | null;
/**
 * Get targets for a signal based on rules
 */
export declare function getAutoRelayTargets(signalType: number, sourceServer: string): string[];
//# sourceMappingURL=rule-engine.d.ts.map