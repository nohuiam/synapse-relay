/**
 * Buffer Manager
 *
 * Manages signal buffering for offline targets with TTL and retry logic.
 */
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/schema.js';
// Retry intervals in milliseconds
const RETRY_INTERVALS = [1000, 5000, 15000];
// Default TTL in hours
const DEFAULT_TTL_HOURS = 24;
// Max retries
const MAX_RETRIES = 3;
let deliveryCallback = null;
/**
 * Set the delivery callback for retrying buffered signals
 */
export function setDeliveryCallback(callback) {
    deliveryCallback = callback;
}
/**
 * Buffer a signal for later delivery
 */
export function bufferSignal(signalType, sourceServer, targetServer, payload, priority = 'normal', ttlHours = DEFAULT_TTL_HOURS) {
    const db = getDatabase();
    const bufferId = uuidv4();
    const buffer = {
        id: bufferId,
        signal_type: signalType,
        source_server: sourceServer,
        target_server: targetServer,
        payload: JSON.stringify(payload),
        priority,
        buffered_at: Date.now(),
        retry_count: 0,
        last_retry_at: null,
        max_retries: MAX_RETRIES,
        expires_at: Date.now() + (ttlHours * 60 * 60 * 1000),
        status: 'pending'
    };
    db.insertBufferedSignal(buffer);
    console.error(`[synapse-relay] Buffered signal for ${targetServer} (ID: ${bufferId})`);
    return bufferId;
}
/**
 * Process pending buffered signals
 */
export async function processBuffer() {
    const db = getDatabase();
    let retried = 0;
    let delivered = 0;
    let failed = 0;
    // First, expire old signals
    const expired = db.expireOldBufferedSignals();
    // Get retryable signals
    const minRetryTime = Date.now() - RETRY_INTERVALS[0];
    const pending = db.getRetryableBufferedSignals(minRetryTime);
    for (const buffer of pending) {
        // Check if we should retry based on retry count and interval
        const retryInterval = RETRY_INTERVALS[Math.min(buffer.retry_count, RETRY_INTERVALS.length - 1)];
        const lastRetry = buffer.last_retry_at || buffer.buffered_at;
        if (Date.now() - lastRetry < retryInterval) {
            continue;
        }
        retried++;
        if (deliveryCallback) {
            const success = await deliveryCallback(buffer);
            if (success) {
                db.updateBufferedSignalStatus(buffer.id, 'delivered');
                delivered++;
                console.error(`[synapse-relay] Delivered buffered signal ${buffer.id} to ${buffer.target_server}`);
            }
            else {
                db.incrementBufferRetryCount(buffer.id);
                if (buffer.retry_count + 1 >= buffer.max_retries) {
                    db.updateBufferedSignalStatus(buffer.id, 'failed');
                    failed++;
                    console.error(`[synapse-relay] Buffer ${buffer.id} failed after max retries`);
                }
            }
        }
    }
    return { retried, delivered, failed, expired };
}
/**
 * Get pending buffered signals for a target
 */
export function getPendingBuffers(targetServer) {
    const db = getDatabase();
    const buffers = db.getPendingBufferedSignals(targetServer);
    return buffers.map(b => ({
        id: b.id,
        signal_type: b.signal_type,
        source_server: b.source_server,
        target_server: b.target_server,
        payload: JSON.parse(b.payload),
        priority: b.priority,
        buffered_at: new Date(b.buffered_at).toISOString(),
        retry_count: b.retry_count,
        status: b.status
    }));
}
/**
 * Retry specific buffered signals
 */
export async function retryBufferedSignals(bufferIds) {
    const db = getDatabase();
    let attempted = 0;
    let delivered = 0;
    let failed = 0;
    for (const id of bufferIds) {
        const buffer = db.getBufferedSignal(id);
        if (!buffer || buffer.status !== 'pending') {
            continue;
        }
        attempted++;
        if (deliveryCallback) {
            const success = await deliveryCallback(buffer);
            if (success) {
                db.updateBufferedSignalStatus(id, 'delivered');
                delivered++;
            }
            else {
                db.incrementBufferRetryCount(id);
                failed++;
            }
        }
    }
    return { attempted, delivered, failed };
}
/**
 * Clear buffered signals
 */
export function clearBufferedSignals(options) {
    const db = getDatabase();
    let cleared = 0;
    if (options.bufferIds && options.bufferIds.length > 0) {
        for (const id of options.bufferIds) {
            if (db.deleteBufferedSignal(id)) {
                cleared++;
            }
        }
    }
    else if (options.targetServer) {
        cleared = db.deleteBufferedSignalsByTarget(options.targetServer);
    }
    return cleared;
}
/**
 * Flush all pending signals to targets
 */
export async function flushBuffer(targetServer) {
    const db = getDatabase();
    const pending = db.getPendingBufferedSignals(targetServer);
    let flushed = 0;
    let delivered = 0;
    let failed = 0;
    for (const buffer of pending) {
        flushed++;
        if (deliveryCallback) {
            const success = await deliveryCallback(buffer);
            if (success) {
                db.updateBufferedSignalStatus(buffer.id, 'delivered');
                delivered++;
            }
            else {
                db.updateBufferedSignalStatus(buffer.id, 'failed');
                failed++;
            }
        }
    }
    return { flushed, delivered, failed };
}
/**
 * Get buffer statistics
 */
export function getBufferStats() {
    const db = getDatabase();
    return db.getBufferStats();
}
//# sourceMappingURL=buffer-manager.js.map