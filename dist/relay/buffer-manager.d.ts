/**
 * Buffer Manager
 *
 * Manages signal buffering for offline targets with TTL and retry logic.
 */
import type { SignalPriority, DbSignalBuffer, BufferItem } from '../types.js';
/**
 * Set the delivery callback for retrying buffered signals
 */
export declare function setDeliveryCallback(callback: (buffer: DbSignalBuffer) => Promise<boolean>): void;
/**
 * Buffer a signal for later delivery
 */
export declare function bufferSignal(signalType: number, sourceServer: string, targetServer: string, payload: Record<string, unknown>, priority?: SignalPriority, ttlHours?: number): string;
/**
 * Process pending buffered signals
 */
export declare function processBuffer(): Promise<{
    retried: number;
    delivered: number;
    failed: number;
    expired: number;
}>;
/**
 * Get pending buffered signals for a target
 */
export declare function getPendingBuffers(targetServer?: string): BufferItem[];
/**
 * Retry specific buffered signals
 */
export declare function retryBufferedSignals(bufferIds: string[]): Promise<{
    attempted: number;
    delivered: number;
    failed: number;
}>;
/**
 * Clear buffered signals
 */
export declare function clearBufferedSignals(options: {
    bufferIds?: string[];
    targetServer?: string;
    signalType?: number;
    maxAgeHours?: number;
}): number;
/**
 * Flush all pending signals to targets
 */
export declare function flushBuffer(targetServer?: string): Promise<{
    flushed: number;
    delivered: number;
    failed: number;
}>;
/**
 * Get buffer statistics
 */
export declare function getBufferStats(): {
    pending: number;
    delivered: number;
    expired: number;
    failed: number;
};
//# sourceMappingURL=buffer-manager.d.ts.map