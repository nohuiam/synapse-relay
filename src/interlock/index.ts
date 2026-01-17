/**
 * InterLock Module Exports
 */

export { encodeMessage, decodeMessage, SignalTypes } from './protocol.js';
export type { InterLockMessage, SignalType } from './protocol.js';

export { initTumbler, validateMessage, getTumblerConfig } from './tumbler.js';
export type { TumblerConfig } from './tumbler.js';

export { initHandlers, handleMessage, sendRelayResponse } from './handlers.js';
export type { HandlerContext } from './handlers.js';

export {
  startInterLock,
  stopInterLock,
  sendToPeer,
  sendHeartbeat,
  getSocket,
  isInterLockRunning
} from './socket.js';
