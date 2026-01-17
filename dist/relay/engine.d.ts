/**
 * Relay Engine
 *
 * Core relay logic for signal routing.
 */
import dgram from 'dgram';
import type { RelayRequest, RelayResult, SignalPriority, InterlockConfig } from '../types.js';
/**
 * Initialize the relay engine
 */
export declare function initRelayEngine(cfg: InterlockConfig, socket: dgram.Socket): void;
/**
 * Relay a signal to target servers
 */
export declare function relaySignal(request: RelayRequest): Promise<RelayResult>;
/**
 * Get relay engine status
 */
export declare function getRelayEngineStatus(): {
    initialized: boolean;
    peers_count: number;
};
/**
 * Multicast signal to multiple targets
 */
export declare function multicastSignal(signalType: number, sourceServer: string, payload: Record<string, unknown>, priority?: SignalPriority, excludeTargets?: string[]): Promise<RelayResult>;
//# sourceMappingURL=engine.d.ts.map