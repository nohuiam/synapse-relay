/**
 * Tool: relay_signal
 *
 * Relay a signal to one or more target servers.
 */

import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { relaySignal } from '../relay/engine.js';
import type { RelaySignalOutput } from '../types.js';

export const RELAY_SIGNAL_SCHEMA = z.object({
  signal_type: z.number().describe('InterLock signal code'),
  target_servers: z.array(z.string()).min(1).describe('Array of target server names'),
  payload: z.record(z.unknown()).describe('Signal payload'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal').describe('Signal priority'),
  retry_on_fail: z.boolean().optional().default(true).describe('Retry on failure'),
  buffer_if_offline: z.boolean().optional().default(true).describe('Buffer if target offline')
});

export type RelaySignalInput = z.infer<typeof RELAY_SIGNAL_SCHEMA>;

export const RELAY_SIGNAL_TOOL: Tool = {
  name: 'relay_signal',
  description: 'Relay a signal to one or more target servers in the InterLock mesh. Supports multicast, buffering for offline targets, and priority routing.',
  inputSchema: {
    type: 'object',
    properties: {
      signal_type: {
        type: 'number',
        description: 'InterLock signal code (e.g., 0xC1)'
      },
      target_servers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of target server names'
      },
      payload: {
        type: 'object',
        description: 'Signal payload'
      },
      priority: {
        type: 'string',
        enum: ['low', 'normal', 'high', 'urgent'],
        description: 'Signal priority (default: normal)'
      },
      retry_on_fail: {
        type: 'boolean',
        description: 'Retry on failure (default: true)'
      },
      buffer_if_offline: {
        type: 'boolean',
        description: 'Buffer if target offline (default: true)'
      }
    },
    required: ['signal_type', 'target_servers', 'payload']
  }
};

export async function handleRelaySignal(args: unknown): Promise<RelaySignalOutput> {
  const input = RELAY_SIGNAL_SCHEMA.parse(args);

  const result = await relaySignal({
    signal_type: input.signal_type,
    source_server: 'synapse-relay',
    target_servers: input.target_servers,
    payload: input.payload as Record<string, unknown>,
    priority: input.priority || 'normal',
    buffer_if_offline: input.buffer_if_offline ?? true
  });

  return {
    relay_id: result.relay_id,
    relayed: result.relayed,
    targets_reached: result.targets_reached,
    targets_buffered: result.targets_buffered,
    latency_ms: result.latency_ms
  };
}
