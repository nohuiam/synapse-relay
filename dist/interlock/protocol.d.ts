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
export interface InterLockMessage {
    signalType: number;
    version: number;
    timestamp: number;
    payload: {
        sender: string;
        [key: string]: unknown;
    };
}
/**
 * Signal types for synapse relay
 */
export declare const SignalTypes: {
    readonly DOCK_REQUEST: 1;
    readonly DOCK_APPROVED: 2;
    readonly DOCK_REJECTED: 3;
    readonly HEARTBEAT: 4;
    readonly UNDOCK: 5;
    readonly RELAY_REQUEST: 80;
    readonly RELAY_RESPONSE: 81;
    readonly RELAY_FAILED: 82;
    readonly BUFFER_FLUSH: 83;
    readonly BUFFER_RETRY: 84;
    readonly PING: 241;
    readonly PONG: 242;
    readonly ERROR: 240;
    readonly SHUTDOWN: 255;
};
export type SignalType = typeof SignalTypes[keyof typeof SignalTypes];
/**
 * Get signal name from type code
 */
export declare function getSignalName(signalType: number): string;
/**
 * Encode a message for UDP transmission (BaNano binary format)
 */
export declare function encodeMessage(signalType: number, sender: string, payload: Record<string, unknown>): Buffer;
/**
 * Encode a message in text format (TYPE:SENDER:PAYLOAD:TIMESTAMP)
 * RESTORED - for backwards compatibility
 */
export declare function encodeTextMessage(type: string, sender: string, payload: Record<string, unknown>): Buffer;
/**
 * Decode a UDP message - supports both binary and text formats
 * Tries binary first, falls back to text
 */
export declare function decodeMessage(buffer: Buffer): InterLockMessage | null;
//# sourceMappingURL=protocol.d.ts.map