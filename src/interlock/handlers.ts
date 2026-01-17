/**
 * InterLock Signal Handlers
 *
 * Routes incoming signals to appropriate handlers.
 */

import type { InterLockMessage } from './protocol.js';
import { SignalTypes, encodeMessage } from './protocol.js';
import { relaySignal } from '../relay/engine.js';
import { getRelayStatistics } from '../relay/stats-aggregator.js';
import type { InterlockConfig } from '../types.js';

export interface HandlerContext {
  sendResponse: (target: string, port: number, message: Buffer) => void;
  config: InterlockConfig;
}

let context: HandlerContext | null = null;

/**
 * Initialize handlers with context
 */
export function initHandlers(ctx: HandlerContext): void {
  context = ctx;
}

/**
 * Handle incoming InterLock message
 */
export async function handleMessage(message: InterLockMessage): Promise<void> {
  const sender = message.payload?.sender || 'unknown';

  switch (message.signalType) {
    case SignalTypes.PING:
      await handlePing(message);
      break;

    case SignalTypes.RELAY_REQUEST:
      await handleRelayRequest(message);
      break;

    case SignalTypes.HEARTBEAT:
      console.error(`[synapse-relay] Received heartbeat from ${sender}`);
      break;

    default:
      console.error(`[synapse-relay] Unknown signal type: 0x${message.signalType.toString(16)}`);
  }
}

async function handlePing(message: InterLockMessage): Promise<void> {
  if (!context) return;

  const sender = message.payload?.sender || 'unknown';
  const peerPort = getPeerPort(sender);
  if (peerPort) {
    const stats = getRelayStatistics(Date.now() - 3600000);
    const response = encodeMessage(SignalTypes.PONG, 'synapse-relay', {
      echo: message.payload,
      status: 'operational',
      total_relayed: stats.total_relayed,
      success_rate: stats.success_rate
    });
    context.sendResponse('localhost', peerPort, response);
  }
}

async function handleRelayRequest(message: InterLockMessage): Promise<void> {
  if (!context) return;

  const sender = message.payload?.sender || 'unknown';

  try {
    const { signal_type, target_servers, payload, priority } = message.payload as unknown as {
      signal_type: number;
      target_servers: string[];
      payload: Record<string, unknown>;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
    };

    const result = await relaySignal({
      signal_type,
      source_server: sender,
      target_servers,
      payload,
      priority: priority || 'normal',
      buffer_if_offline: true
    });

    const peerPort = getPeerPort(sender);
    if (peerPort) {
      const response = encodeMessage(SignalTypes.RELAY_RESPONSE, 'synapse-relay', {
        relay_id: result.relay_id,
        relayed: result.relayed,
        targets_reached: result.targets_reached,
        targets_buffered: result.targets_buffered,
        latency_ms: result.latency_ms
      });
      context.sendResponse('localhost', peerPort, response);
    }
  } catch (error) {
    console.error('[synapse-relay] Relay request failed:', (error as Error).message);

    const peerPort = getPeerPort(sender);
    if (peerPort) {
      const response = encodeMessage(SignalTypes.RELAY_FAILED, 'synapse-relay', {
        error: (error as Error).message
      });
      context.sendResponse('localhost', peerPort, response);
    }
  }
}

/**
 * Get peer port from context config
 */
function getPeerPort(peerName: string): number | null {
  if (!context) return null;
  return context.config.peer_ports[peerName] || null;
}

/**
 * Broadcast relay response to origin
 */
export function sendRelayResponse(
  targetPort: number,
  relayId: string,
  success: boolean,
  sendToPeer: (port: number, message: Buffer) => void
): void {
  const response = encodeMessage(
    success ? SignalTypes.RELAY_RESPONSE : SignalTypes.RELAY_FAILED,
    'synapse-relay',
    { relay_id: relayId, success }
  );
  sendToPeer(targetPort, response);
}
