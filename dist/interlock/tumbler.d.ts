/**
 * InterLock Tumbler - Whitelist filtering for mesh security
 */
import type { InterLockMessage } from './protocol.js';
export interface TumblerConfig {
    allowedPeers: string[];
    allowedSignals: number[];
}
/**
 * Initialize tumbler with configuration
 */
export declare function initTumbler(peers: string[], signals: string[]): void;
/**
 * Check if a message passes the whitelist filter
 */
export declare function validateMessage(message: InterLockMessage): boolean;
/**
 * Get current tumbler configuration
 */
export declare function getTumblerConfig(): TumblerConfig;
//# sourceMappingURL=tumbler.d.ts.map