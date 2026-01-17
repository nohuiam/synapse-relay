/**
 * InterLock UDP Socket
 *
 * Handles UDP communication for the mesh network.
 */
import dgram from 'dgram';
import type { InterlockConfig } from '../types.js';
/**
 * Start the InterLock UDP socket
 */
export declare function startInterLock(config: InterlockConfig): Promise<dgram.Socket>;
/**
 * Stop the InterLock socket
 */
export declare function stopInterLock(): Promise<void>;
/**
 * Send a message to a peer
 */
export declare function sendToPeer(targetPort: number, message: Buffer): void;
/**
 * Send heartbeat to peers
 */
export declare function sendHeartbeat(peerPorts: number[]): void;
/**
 * Get the UDP socket
 */
export declare function getSocket(): dgram.Socket | null;
/**
 * Check if InterLock is running
 */
export declare function isInterLockRunning(): boolean;
//# sourceMappingURL=socket.d.ts.map