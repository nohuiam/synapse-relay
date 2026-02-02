/**
 * InterLock Module Exports
 * Uses @bop/interlock shared package for socket management.
 */
export { SignalTypes as SharedSignalTypes, getSignalName } from '@bop/interlock';
// Local protocol exports (server-specific signals)
export { encodeMessage, decodeMessage, SignalTypes } from './protocol.js';
export { initTumbler, validateMessage, getTumblerConfig } from './tumbler.js';
export { initHandlers, handleMessage, sendRelayResponse } from './handlers.js';
export { startInterLock, stopInterLock, sendToPeer, sendHeartbeat, getSocket, isInterLockRunning, getSocketStats } from './socket.js';
//# sourceMappingURL=index.js.map