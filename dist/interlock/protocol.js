/**
 * InterLock Protocol - Official BaNano Binary Format
 *
 * 12-byte header:
 * Bytes 0-1:   Signal Type (uint16, big-endian)
 * Bytes 2-3:   Protocol Version (uint16, big-endian)
 * Bytes 4-7:   Payload Length (uint32, big-endian)
 * Bytes 8-11:  Timestamp (uint32, Unix seconds)
 * Bytes 12+:   Payload (JSON, UTF-8)
 */
// Protocol version 1.0
const PROTOCOL_VERSION = 0x0100;
/**
 * Signal types for synapse relay
 */
export const SignalTypes = {
    // Core signals
    DOCK_REQUEST: 0x01,
    DOCK_APPROVED: 0x02,
    DOCK_REJECTED: 0x03,
    HEARTBEAT: 0x04,
    UNDOCK: 0x05,
    // Relay signals
    RELAY_REQUEST: 0x50,
    RELAY_RESPONSE: 0x51,
    RELAY_FAILED: 0x52,
    BUFFER_FLUSH: 0x53,
    BUFFER_RETRY: 0x54,
    // Standard signals
    PING: 0xF1,
    PONG: 0xF2,
    ERROR: 0xF0,
    SHUTDOWN: 0xFF
};
// Signal name mappings
const SIGNAL_NAMES = {
    [SignalTypes.DOCK_REQUEST]: 'DOCK_REQUEST',
    [SignalTypes.DOCK_APPROVED]: 'DOCK_APPROVED',
    [SignalTypes.DOCK_REJECTED]: 'DOCK_REJECTED',
    [SignalTypes.HEARTBEAT]: 'HEARTBEAT',
    [SignalTypes.UNDOCK]: 'UNDOCK',
    [SignalTypes.RELAY_REQUEST]: 'RELAY_REQUEST',
    [SignalTypes.RELAY_RESPONSE]: 'RELAY_RESPONSE',
    [SignalTypes.RELAY_FAILED]: 'RELAY_FAILED',
    [SignalTypes.BUFFER_FLUSH]: 'BUFFER_FLUSH',
    [SignalTypes.BUFFER_RETRY]: 'BUFFER_RETRY',
    [SignalTypes.PING]: 'PING',
    [SignalTypes.PONG]: 'PONG',
    [SignalTypes.ERROR]: 'ERROR',
    [SignalTypes.SHUTDOWN]: 'SHUTDOWN',
};
/**
 * Get signal name from type code
 */
export function getSignalName(signalType) {
    return SIGNAL_NAMES[signalType] || `UNKNOWN_0x${signalType.toString(16).toUpperCase()}`;
}
/**
 * Encode a message for UDP transmission (BaNano binary format)
 */
export function encodeMessage(signalType, sender, payload) {
    const fullPayload = JSON.stringify({ sender, ...payload });
    const payloadBuffer = Buffer.from(fullPayload, 'utf8');
    const header = Buffer.alloc(12);
    header.writeUInt16BE(signalType, 0);
    header.writeUInt16BE(PROTOCOL_VERSION, 2);
    header.writeUInt32BE(payloadBuffer.length, 4);
    header.writeUInt32BE(Math.floor(Date.now() / 1000), 8);
    return Buffer.concat([header, payloadBuffer]);
}
/**
 * Decode binary BaNano format (12-byte header + JSON)
 */
function decodeBinaryMessage(buffer) {
    try {
        const signalType = buffer.readUInt16BE(0);
        const version = buffer.readUInt16BE(2);
        const payloadLength = buffer.readUInt32BE(4);
        const timestamp = buffer.readUInt32BE(8);
        // Validate: signal type should be in valid range
        if (signalType === 0 || signalType > 0xFF) {
            return null;
        }
        if (payloadLength > buffer.length - 12) {
            return null;
        }
        // Parse JSON payload
        const payloadStr = buffer.slice(12, 12 + payloadLength).toString('utf8');
        const payload = JSON.parse(payloadStr);
        // Ensure payload has sender (servers may send serverId instead)
        if (!payload.sender) {
            payload.sender = payload.serverId || payload.source || 'unknown';
        }
        return {
            signalType,
            version,
            timestamp,
            payload,
        };
    }
    catch {
        return null;
    }
}
/**
 * Map string signal type to numeric code
 */
function mapTypeStringToNumber(typeStr) {
    const mapping = {
        'HEARTBEAT': SignalTypes.HEARTBEAT,
        'DOCK_REQUEST': SignalTypes.DOCK_REQUEST,
        'DOCK_APPROVED': SignalTypes.DOCK_APPROVED,
        'DOCK_REJECTED': SignalTypes.DOCK_REJECTED,
        'UNDOCK': SignalTypes.UNDOCK,
        'RELAY_REQUEST': SignalTypes.RELAY_REQUEST,
        'RELAY_RESPONSE': SignalTypes.RELAY_RESPONSE,
        'RELAY_FAILED': SignalTypes.RELAY_FAILED,
        'PING': SignalTypes.PING,
        'PONG': SignalTypes.PONG,
        'ERROR': SignalTypes.ERROR,
        'SHUTDOWN': SignalTypes.SHUTDOWN,
    };
    return mapping[typeStr.toUpperCase()] || 0x00;
}
/**
 * Encode a message in text format (TYPE:SENDER:PAYLOAD:TIMESTAMP)
 * RESTORED - for backwards compatibility
 */
export function encodeTextMessage(type, sender, payload) {
    const timestamp = Date.now();
    const encoded = `${type}:${sender}:${JSON.stringify(payload)}:${timestamp}`;
    return Buffer.from(encoded, 'utf-8');
}
/**
 * Decode text format - supports multiple formats:
 * - Colon format: TYPE:SENDER:PAYLOAD:TIMESTAMP
 * - Format A: {t, s, d, ts}
 * - Format B: {type, source, payload, timestamp}
 */
function decodeTextMessage(buffer) {
    try {
        const str = buffer.toString('utf-8');
        // Try JSON formats first
        if (str.startsWith('{')) {
            const json = JSON.parse(str);
            // Format A: {t, s, d, ts}
            if ('t' in json && 's' in json) {
                return {
                    signalType: typeof json.t === 'number' ? json.t : mapTypeStringToNumber(String(json.t)),
                    version: PROTOCOL_VERSION,
                    timestamp: Math.floor((json.ts || Date.now()) / 1000),
                    payload: {
                        sender: json.s,
                        ...(typeof json.d === 'object' && json.d !== null ? json.d : { data: json.d })
                    }
                };
            }
            // Format B: {type, source, payload, timestamp}
            if ('type' in json && 'source' in json) {
                return {
                    signalType: typeof json.type === 'number' ? json.type : mapTypeStringToNumber(String(json.type)),
                    version: PROTOCOL_VERSION,
                    timestamp: Math.floor((json.timestamp || Date.now()) / 1000),
                    payload: {
                        sender: json.source,
                        ...(typeof json.payload === 'object' && json.payload !== null ? json.payload : {})
                    }
                };
            }
        }
        // Colon format: TYPE:SENDER:PAYLOAD:TIMESTAMP
        const parts = str.split(':');
        if (parts.length >= 4) {
            const type = parts[0];
            const sender = parts[1];
            const payloadStr = parts.slice(2, -1).join(':');
            const timestamp = parseInt(parts[parts.length - 1], 10);
            let payloadData;
            try {
                payloadData = JSON.parse(payloadStr);
            }
            catch {
                payloadData = { raw: payloadStr };
            }
            return {
                signalType: mapTypeStringToNumber(type),
                version: PROTOCOL_VERSION,
                timestamp: Math.floor(timestamp / 1000),
                payload: {
                    sender,
                    ...payloadData
                }
            };
        }
        return null;
    }
    catch {
        return null;
    }
}
/**
 * Decode a UDP message - supports both binary and text formats
 * Tries binary first, falls back to text
 */
export function decodeMessage(buffer) {
    if (!buffer || buffer.length < 2) {
        return null;
    }
    // Try binary format first (12-byte header)
    if (buffer.length >= 12) {
        const binaryResult = decodeBinaryMessage(buffer);
        if (binaryResult)
            return binaryResult;
    }
    // Fall back to text format
    const textResult = decodeTextMessage(buffer);
    if (textResult)
        return textResult;
    return null;
}
//# sourceMappingURL=protocol.js.map