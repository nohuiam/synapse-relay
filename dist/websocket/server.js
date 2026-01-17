/**
 * WebSocket Server
 *
 * Port: 9025
 * Provides real-time event broadcasting for relay operations.
 */
import { WebSocketServer, WebSocket } from 'ws';
export class WebSocketService {
    wss = null;
    port;
    clients = new Map();
    constructor(port) {
        this.port = port;
    }
    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.wss = new WebSocketServer({ port: this.port });
                this.wss.on('connection', (ws) => {
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
                    ws.on('message', (message) => {
                        try {
                            const data = JSON.parse(message.toString());
                            this.handleMessage(ws, data);
                        }
                        catch {
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
            }
            catch (error) {
                reject(error);
            }
        });
    }
    handleMessage(ws, message) {
        switch (message.type) {
            case 'subscribe':
                this.handleSubscribe(ws, message.data);
                break;
            case 'unsubscribe':
                this.handleUnsubscribe(ws, message.data);
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
    handleSubscribe(ws, data) {
        const subscription = this.clients.get(ws);
        if (!subscription)
            return;
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
    handleUnsubscribe(ws, data) {
        const subscription = this.clients.get(ws);
        if (!subscription)
            return;
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
    sendTo(ws, event) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(event));
        }
    }
    matchesTopic(topic, subscribed) {
        if (subscribed.has('*'))
            return true;
        if (subscribed.has(topic))
            return true;
        // Check for wildcard matches like 'relay:*'
        for (const sub of subscribed) {
            if (sub.endsWith(':*')) {
                const prefix = sub.slice(0, -1);
                if (topic.startsWith(prefix))
                    return true;
            }
        }
        return false;
    }
    /**
     * Broadcast event to matching subscribers
     */
    broadcast(type, data, topic) {
        const event = {
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
    emitRelaySent(relayId, targetsReached, latencyMs) {
        this.broadcast('relay:sent', {
            relay_id: relayId,
            targets_reached: targetsReached,
            latency_ms: latencyMs
        });
    }
    /**
     * Emit relay failed event
     */
    emitRelayFailed(relayId, targetsFailed, error) {
        this.broadcast('relay:failed', {
            relay_id: relayId,
            targets_failed: targetsFailed,
            error
        });
    }
    /**
     * Emit relay buffered event
     */
    emitRelayBuffered(bufferId, targetServer, signalType) {
        this.broadcast('relay:buffered', {
            buffer_id: bufferId,
            target_server: targetServer,
            signal_type: signalType
        }, `relay:target:${targetServer}`);
    }
    /**
     * Emit buffer retry event
     */
    emitBufferRetry(bufferId, targetServer, retryCount) {
        this.broadcast('buffer:retry', {
            buffer_id: bufferId,
            target_server: targetServer,
            retry_count: retryCount
        });
    }
    /**
     * Emit buffer expired event
     */
    emitBufferExpired(count) {
        this.broadcast('buffer:expired', { expired_count: count });
    }
    /**
     * Emit stats update event
     */
    emitStatsUpdate(stats) {
        this.broadcast('stats:update', stats);
    }
    /**
     * Get number of connected clients
     */
    getClientCount() {
        return this.clients.size;
    }
    async stop() {
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
            }
            else {
                resolve();
            }
        });
    }
}
//# sourceMappingURL=server.js.map