/**
 * Tool: buffer_signals
 *
 * Manage buffered signals for offline targets.
 */
import { z } from 'zod';
import { getPendingBuffers, retryBufferedSignals, clearBufferedSignals, flushBuffer } from '../relay/buffer-manager.js';
export const BUFFER_SIGNALS_SCHEMA = z.object({
    action: z.enum(['list', 'retry', 'clear', 'flush']).describe('Action to perform'),
    target_server: z.string().optional().describe('Filter by target server'),
    signal_type: z.number().optional().describe('Filter by signal type'),
    max_age_hours: z.number().optional().describe('Filter by max age in hours'),
    buffer_ids: z.array(z.string()).optional().describe('Specific buffer IDs for retry/clear')
});
export const BUFFER_SIGNALS_TOOL = {
    name: 'buffer_signals',
    description: 'Manage buffered signals for offline targets. List, retry, clear, or flush buffered signals.',
    inputSchema: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['list', 'retry', 'clear', 'flush'],
                description: 'Action to perform'
            },
            target_server: {
                type: 'string',
                description: 'Filter by target server'
            },
            signal_type: {
                type: 'number',
                description: 'Filter by signal type'
            },
            max_age_hours: {
                type: 'number',
                description: 'Filter by max age in hours'
            },
            buffer_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific buffer IDs for retry/clear'
            }
        },
        required: ['action']
    }
};
export async function handleBufferSignals(args) {
    const input = BUFFER_SIGNALS_SCHEMA.parse(args);
    switch (input.action) {
        case 'list': {
            const items = getPendingBuffers(input.target_server);
            // Filter by signal type if specified
            let filtered = items;
            if (input.signal_type !== undefined) {
                filtered = items.filter(i => i.signal_type === input.signal_type);
            }
            // Filter by age if specified
            if (input.max_age_hours !== undefined) {
                const cutoff = Date.now() - (input.max_age_hours * 60 * 60 * 1000);
                filtered = filtered.filter(i => new Date(i.buffered_at).getTime() >= cutoff);
            }
            return {
                action: 'list',
                affected_count: filtered.length,
                buffer_items: filtered
            };
        }
        case 'retry': {
            if (!input.buffer_ids || input.buffer_ids.length === 0) {
                throw new Error('retry requires buffer_ids');
            }
            const result = await retryBufferedSignals(input.buffer_ids);
            return {
                action: 'retry',
                affected_count: result.delivered
            };
        }
        case 'clear': {
            const cleared = clearBufferedSignals({
                bufferIds: input.buffer_ids,
                targetServer: input.target_server,
                signalType: input.signal_type,
                maxAgeHours: input.max_age_hours
            });
            return {
                action: 'clear',
                affected_count: cleared
            };
        }
        case 'flush': {
            const result = await flushBuffer(input.target_server);
            return {
                action: 'flush',
                affected_count: result.delivered
            };
        }
        default:
            throw new Error(`Unknown action: ${input.action}`);
    }
}
//# sourceMappingURL=buffer-signals.js.map