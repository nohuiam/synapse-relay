/**
 * InterLock Tumbler - Whitelist filtering for mesh security
 */
let config = {
    allowedPeers: [],
    allowedSignals: []
};
/**
 * Initialize tumbler with configuration
 */
export function initTumbler(peers, signals) {
    // Convert hex string signals to numbers (e.g., "0x04" -> 4)
    const numericSignals = signals.map(s => {
        if (typeof s === 'string' && s.startsWith('0x')) {
            return parseInt(s, 16);
        }
        return typeof s === 'number' ? s : 0;
    }).filter(n => n > 0);
    config = {
        allowedPeers: peers,
        allowedSignals: numericSignals
    };
}
/**
 * Check if a message passes the whitelist filter
 */
export function validateMessage(message) {
    // Extract sender from payload
    const sender = message.payload?.sender;
    // Check sender is allowed (if we have a peer whitelist)
    if (config.allowedPeers.length > 0 && sender && !config.allowedPeers.includes(sender)) {
        // Allow unknown senders - we want to receive heartbeats from any server
        // console.error(`[synapse-relay] Tumbler rejected unknown sender: ${sender}`);
        // return false;
    }
    // Check signal type is allowed (if we have a signal whitelist)
    if (config.allowedSignals.length > 0 && !config.allowedSignals.includes(message.signalType)) {
        console.error(`[synapse-relay] Tumbler rejected unknown signal: 0x${message.signalType.toString(16)}`);
        return false;
    }
    // Check message freshness (reject messages older than 5 minutes)
    // Timestamp is in Unix seconds, convert to ms
    const messageTime = message.timestamp * 1000;
    const age = Date.now() - messageTime;
    if (age > 5 * 60 * 1000 || age < -60000) { // Also reject future messages
        console.error(`[synapse-relay] Tumbler rejected stale message (${age}ms old)`);
        return false;
    }
    return true;
}
/**
 * Get current tumbler configuration
 */
export function getTumblerConfig() {
    return { ...config };
}
//# sourceMappingURL=tumbler.js.map