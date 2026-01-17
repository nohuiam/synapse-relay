/**
 * WebSocket Server
 *
 * Port: 9025
 * Provides real-time event broadcasting for relay operations.
 */
export type EventType = 'relay:sent' | 'relay:failed' | 'relay:buffered' | 'buffer:retry' | 'buffer:expired' | 'stats:update' | 'error';
export interface WebSocketEvent {
    type: EventType;
    data: unknown;
    timestamp: string;
}
export declare class WebSocketService {
    private wss;
    private port;
    private clients;
    constructor(port: number);
    start(): Promise<void>;
    private handleMessage;
    private handleSubscribe;
    private handleUnsubscribe;
    private sendTo;
    private matchesTopic;
    /**
     * Broadcast event to matching subscribers
     */
    broadcast(type: EventType, data: unknown, topic?: string): void;
    /**
     * Emit relay sent event
     */
    emitRelaySent(relayId: string, targetsReached: string[], latencyMs: number): void;
    /**
     * Emit relay failed event
     */
    emitRelayFailed(relayId: string, targetsFailed: string[], error?: string): void;
    /**
     * Emit relay buffered event
     */
    emitRelayBuffered(bufferId: string, targetServer: string, signalType: number): void;
    /**
     * Emit buffer retry event
     */
    emitBufferRetry(bufferId: string, targetServer: string, retryCount: number): void;
    /**
     * Emit buffer expired event
     */
    emitBufferExpired(count: number): void;
    /**
     * Emit stats update event
     */
    emitStatsUpdate(stats: {
        total_relayed: number;
        success_rate: number;
    }): void;
    /**
     * Get number of connected clients
     */
    getClientCount(): number;
    stop(): Promise<void>;
}
//# sourceMappingURL=server.d.ts.map