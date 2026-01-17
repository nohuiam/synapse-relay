/**
 * InterLock Signal Handlers
 *
 * Routes incoming signals to appropriate handlers.
 */
import type { InterLockMessage } from './protocol.js';
import type { InterlockConfig } from '../types.js';
export interface HandlerContext {
    sendResponse: (target: string, port: number, message: Buffer) => void;
    config: InterlockConfig;
}
/**
 * Initialize handlers with context
 */
export declare function initHandlers(ctx: HandlerContext): void;
/**
 * Handle incoming InterLock message
 */
export declare function handleMessage(message: InterLockMessage): Promise<void>;
/**
 * Broadcast relay response to origin
 */
export declare function sendRelayResponse(targetPort: number, relayId: string, success: boolean, sendToPeer: (port: number, message: Buffer) => void): void;
//# sourceMappingURL=handlers.d.ts.map