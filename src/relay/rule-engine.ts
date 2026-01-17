/**
 * Rule Engine
 *
 * Pattern matching and automatic routing for signals.
 */

import { getDatabase } from '../database/schema.js';
import type { DbRelayRule, RelayRule, RuleAction } from '../types.js';

/**
 * Match rules for a signal
 */
export function matchRules(signalType: number, sourceServer: string): DbRelayRule[] {
  const db = getDatabase();
  const rules = db.getEnabledRelayRules();

  return rules.filter(rule => {
    // Check signal pattern match
    if (rule.signal_pattern !== signalType) {
      return false;
    }

    // Check source filter if present
    if (rule.source_filter) {
      try {
        const regex = new RegExp(rule.source_filter);
        if (!regex.test(sourceServer)) {
          return false;
        }
      } catch {
        // Invalid regex, skip filter
      }
    }

    // Increment match count
    db.incrementRuleMatchCount(rule.id);

    return true;
  });
}

/**
 * Apply transformation to payload
 */
export function applyTransform(
  payload: Record<string, unknown>,
  transform: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...payload };

  // Apply each transform operation
  for (const [key, value] of Object.entries(transform)) {
    if (value === null) {
      // Remove field
      delete result[key];
    } else if (typeof value === 'object' && value !== null && 'rename' in value) {
      // Rename field
      const renameFrom = (value as { rename: string }).rename;
      if (renameFrom in result) {
        result[key] = result[renameFrom];
        delete result[renameFrom];
      }
    } else {
      // Set or override field
      result[key] = value;
    }
  }

  return result;
}

/**
 * Add a new relay rule
 */
export function addRule(
  signalPattern: number,
  relayTo: string[],
  options: {
    sourceFilter?: string;
    transform?: Record<string, unknown>;
    priority?: number;
    enabled?: boolean;
  } = {}
): number {
  const db = getDatabase();

  return db.insertRelayRule({
    signal_pattern: signalPattern,
    source_filter: options.sourceFilter || null,
    relay_to: JSON.stringify(relayTo),
    transform: options.transform ? JSON.stringify(options.transform) : null,
    priority: options.priority ?? 0,
    enabled: (options.enabled ?? true) ? 1 : 0,
    created_at: Date.now(),
    updated_at: null,
    match_count: 0
  });
}

/**
 * Update an existing rule
 */
export function updateRule(
  ruleId: number,
  updates: {
    signalPattern?: number;
    sourceFilter?: string | null;
    relayTo?: string[];
    transform?: Record<string, unknown> | null;
    priority?: number;
    enabled?: boolean;
  }
): boolean {
  const db = getDatabase();

  const dbUpdates: Partial<DbRelayRule> = {};

  if (updates.signalPattern !== undefined) {
    dbUpdates.signal_pattern = updates.signalPattern;
  }
  if (updates.sourceFilter !== undefined) {
    dbUpdates.source_filter = updates.sourceFilter;
  }
  if (updates.relayTo !== undefined) {
    dbUpdates.relay_to = JSON.stringify(updates.relayTo);
  }
  if (updates.transform !== undefined) {
    dbUpdates.transform = updates.transform ? JSON.stringify(updates.transform) : null;
  }
  if (updates.priority !== undefined) {
    dbUpdates.priority = updates.priority;
  }
  if (updates.enabled !== undefined) {
    dbUpdates.enabled = updates.enabled ? 1 : 0;
  }

  return db.updateRelayRule(ruleId, dbUpdates);
}

/**
 * Remove a rule
 */
export function removeRule(ruleId: number): boolean {
  const db = getDatabase();
  return db.deleteRelayRule(ruleId);
}

/**
 * List all rules
 */
export function listRules(): RelayRule[] {
  const db = getDatabase();
  const rules = db.getAllRelayRules();

  return rules.map(r => ({
    id: r.id,
    signal_pattern: r.signal_pattern,
    source_filter: r.source_filter,
    relay_to: JSON.parse(r.relay_to) as string[],
    transform: r.transform ? JSON.parse(r.transform) as Record<string, unknown> : null,
    priority: r.priority,
    enabled: r.enabled === 1,
    created_at: new Date(r.created_at).toISOString(),
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    match_count: r.match_count
  }));
}

/**
 * Get a specific rule
 */
export function getRule(ruleId: number): RelayRule | null {
  const db = getDatabase();
  const r = db.getRelayRule(ruleId);

  if (!r) return null;

  return {
    id: r.id,
    signal_pattern: r.signal_pattern,
    source_filter: r.source_filter,
    relay_to: JSON.parse(r.relay_to) as string[],
    transform: r.transform ? JSON.parse(r.transform) as Record<string, unknown> : null,
    priority: r.priority,
    enabled: r.enabled === 1,
    created_at: new Date(r.created_at).toISOString(),
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    match_count: r.match_count
  };
}

/**
 * Get targets for a signal based on rules
 */
export function getAutoRelayTargets(signalType: number, sourceServer: string): string[] {
  const rules = matchRules(signalType, sourceServer);
  const targets = new Set<string>();

  for (const rule of rules) {
    const relayTo = JSON.parse(rule.relay_to) as string[];
    for (const target of relayTo) {
      targets.add(target);
    }
  }

  return Array.from(targets);
}
