/**
 * WebSocket Server
 *
 * Port: 9025
 * Provides real-time event broadcasting for relay operations.
 */

import { WebSocketServer, WebSocket } from 'ws';

export type EventType =
  | 'relay:sent'
  | 'relay:failed'
  | 'relay:buffered'
  | 'buffer:retry'
  | 'buffer:expired'
  | 'stats:update'
  | 'error';

export interface WebSocketEvent {
  type: EventType;
  data: unknown;
  timestamp: string;
}

interface Subscription {
  topics: Set<string>;
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private port: number;
  private clients: Map<WebSocket, Subscription> = new Map();

  constructor(port: number) {
    this.port = port;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port: this.port });

        this.wss.on('connection', (ws: WebSocket) => {
          this.clients.set(ws, { topics: new Set(['*']) });
          console.error(`[synapse-relay] WebSocket client connected (${this.clients.size} total)`);

          // Send welcome message
          this.sendTo(ws, {
            type: 'relay:sent',
            data: { message: 'Connected to Synapse Relay WebSocket' },
            timestamp: new Date().toISOString()
          });

          ws.on('close', () => {
            this.clients.delete(ws);
            console.error(`[synapse-relay] WebSocket client disconnected (${this.clients.size} remaining)`);
          });

          ws.on('error', (error) => {
            console.error('[synapse-relay] WebSocket client error:', error.message);
            this.clients.delete(ws);
          });

          ws.on('message', (message: Buffer) => {
            try {
              const data = JSON.parse(message.toString());
              this.handleMessage(ws, data);
            } catch {
              this.sendTo(ws, {
                type: 'error',
                data: { error: 'Invalid message format' },
                timestamp: new Date().toISOString()
              });
            }
          });
        });

        this.wss.on('listening', () => {
          console.error(`[synapse-relay] WebSocket server listening on port ${this.port}`);
          resolve();
        });

        this.wss.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(ws: WebSocket, message: { type: string; data?: unknown }): void {
    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(ws, message.data as { topics?: string[] });
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(ws, message.data as { topics?: string[] });
        break;

      case 'ping':
        this.sendTo(ws, {
          type: 'relay:sent',
          data: { pong: true },
          timestamp: new Date().toISOString()
        });
        break;

      default:
        this.sendTo(ws, {
          type: 'error',
          data: { error: `Unknown message type: ${message.type}` },
          timestamp: new Date().toISOString()
        });
    }
  }

  private handleSubscribe(ws: WebSocket, data: { topics?: string[] }): void {
    const subscription = this.clients.get(ws);
    if (!subscription) return;

    const topics = data?.topics || ['*'];
    for (const topic of topics) {
      subscription.topics.add(topic);
    }

    this.sendTo(ws, {
      type: 'relay:sent',
      data: { subscribed: Array.from(subscription.topics) },
      timestamp: new Date().toISOString()
    });
  }

  private handleUnsubscribe(ws: WebSocket, data: { topics?: string[] }): void {
    const subscription = this.clients.get(ws);
    if (!subscription) return;

    const topics = data?.topics || [];
    for (const topic of topics) {
      subscription.topics.delete(topic);
    }

    this.sendTo(ws, {
      type: 'relay:sent',
      data: { subscribed: Array.from(subscription.topics) },
      timestamp: new Date().toISOString()
    });
  }

  private sendTo(ws: WebSocket, event: WebSocketEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  private matchesTopic(topic: string, subscribed: Set<string>): boolean {
    if (subscribed.has('*')) return true;
    if (subscribed.has(topic)) return true;

    // Check for wildcard matches like 'relay:*'
    for (const sub of subscribed) {
      if (sub.endsWith(':*')) {
        const prefix = sub.slice(0, -1);
        if (topic.startsWith(prefix)) return true;
      }
    }

    return false;
  }

  /**
   * Broadcast event to matching subscribers
   */
  broadcast(type: EventType, data: unknown, topic?: string): void {
    const event: WebSocketEvent = {
      type,
      data,
      timestamp: new Date().toISOString()
    };

    const message = JSON.stringify(event);
    const matchTopic = topic || type;

    for (const [client, subscription] of this.clients) {
      if (client.readyState === WebSocket.OPEN && this.matchesTopic(matchTopic, subscription.topics)) {
        client.send(message);
      }
    }
  }

  /**
   * Emit relay sent event
   */
  emitRelaySent(relayId: string, targetsReached: string[], latencyMs: number): void {
    this.broadcast('relay:sent', {
      relay_id: relayId,
      targets_reached: targetsReached,
      latency_ms: latencyMs
    });
  }

  /**
   * Emit relay failed event
   */
  emitRelayFailed(relayId: string, targetsFailed: string[], error?: string): void {
    this.broadcast('relay:failed', {
      relay_id: relayId,
      targets_failed: targetsFailed,
      error
    });
  }

  /**
   * Emit relay buffered event
   */
  emitRelayBuffered(bufferId: string, targetServer: string, signalType: number): void {
    this.broadcast('relay:buffered', {
      buffer_id: bufferId,
      target_server: targetServer,
      signal_type: signalType
    }, `relay:target:${targetServer}`);
  }

  /**
   * Emit buffer retry event
   */
  emitBufferRetry(bufferId: string, targetServer: string, retryCount: number): void {
    this.broadcast('buffer:retry', {
      buffer_id: bufferId,
      target_server: targetServer,
      retry_count: retryCount
    });
  }

  /**
   * Emit buffer expired event
   */
  emitBufferExpired(count: number): void {
    this.broadcast('buffer:expired', { expired_count: count });
  }

  /**
   * Emit stats update event
   */
  emitStatsUpdate(stats: { total_relayed: number; success_rate: number }): void {
    this.broadcast('stats:update', stats);
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        for (const [client] of this.clients) {
          client.close();
        }
        this.clients.clear();

        this.wss.close(() => {
          console.error('[synapse-relay] WebSocket server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
