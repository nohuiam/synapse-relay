/**
 * Tool: configure_relay
 *
 * Configure automatic relay rules for signal routing.
 */
import { z } from 'zod';
import { addRule, updateRule, removeRule, listRules } from '../relay/rule-engine.js';
export const CONFIGURE_RELAY_SCHEMA = z.object({
    action: z.enum(['add', 'update', 'remove', 'list']).describe('Action to perform'),
    rule_id: z.number().optional().describe('Rule ID for update/remove'),
    signal_pattern: z.number().optional().describe('Signal type to match'),
    source_filter: z.string().optional().describe('Regex for source server'),
    relay_to: z.array(z.string()).optional().describe('Target servers'),
    transform: z.record(z.unknown()).optional().describe('Payload transformation'),
    enabled: z.boolean().optional().describe('Enable/disable rule'),
    priority: z.number().optional().describe('Rule priority (higher = evaluated first)')
});
export const CONFIGURE_RELAY_TOOL = {
    name: 'configure_relay',
    description: 'Configure automatic relay rules for signal routing. Rules define automatic forwarding of signals based on type and source patterns.',
    inputSchema: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['add', 'update', 'remove', 'list'],
                description: 'Action to perform'
            },
            rule_id: {
                type: 'number',
                description: 'Rule ID for update/remove'
            },
            signal_pattern: {
                type: 'number',
                description: 'Signal type to match'
            },
            source_filter: {
                type: 'string',
                description: 'Regex for source server'
            },
            relay_to: {
                type: 'array',
                items: { type: 'string' },
                description: 'Target servers'
            },
            transform: {
                type: 'object',
                description: 'Payload transformation'
            },
            enabled: {
                type: 'boolean',
                description: 'Enable/disable rule'
            },
            priority: {
                type: 'number',
                description: 'Rule priority (higher = evaluated first)'
            }
        },
        required: ['action']
    }
};
export function handleConfigureRelay(args) {
    const input = CONFIGURE_RELAY_SCHEMA.parse(args);
    switch (input.action) {
        case 'add': {
            if (!input.signal_pattern || !input.relay_to || input.relay_to.length === 0) {
                throw new Error('add requires signal_pattern and relay_to');
            }
            const ruleId = addRule(input.signal_pattern, input.relay_to, {
                sourceFilter: input.source_filter,
                transform: input.transform,
                priority: input.priority,
                enabled: input.enabled
            });
            return {
                rule_id: ruleId,
                action: 'add',
                success: true
            };
        }
        case 'update': {
            if (!input.rule_id) {
                throw new Error('update requires rule_id');
            }
            const success = updateRule(input.rule_id, {
                signalPattern: input.signal_pattern,
                sourceFilter: input.source_filter,
                relayTo: input.relay_to,
                transform: input.transform,
                priority: input.priority,
                enabled: input.enabled
            });
            return {
                rule_id: input.rule_id,
                action: 'update',
                success
            };
        }
        case 'remove': {
            if (!input.rule_id) {
                throw new Error('remove requires rule_id');
            }
            const success = removeRule(input.rule_id);
            return {
                rule_id: input.rule_id,
                action: 'remove',
                success
            };
        }
        case 'list': {
            const rules = listRules();
            return {
                rule_id: 0,
                action: 'list',
                success: true,
                rules
            };
        }
        default:
            throw new Error(`Unknown action: ${input.action}`);
    }
}
//# sourceMappingURL=configure-relay.js.map