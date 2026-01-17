/**
 * InterLock UDP Socket
 *
 * Handles UDP communication for the mesh network.
 */

import dgram from 'dgram';
import { decodeMessage, encodeMessage, SignalTypes } from './protocol.js';
import { validateMessage, initTumbler } from './tumbler.js';
import { handleMessage, initHandlers } from './handlers.js';
import type { InterlockConfig } from '../types.js';

let socket: dgram.Socket | null = null;
let port: number = 3025;

/**
 * Start the InterLock UDP socket
 */
export async function startInterLock(config: InterlockConfig): Promise<dgram.Socket> {
  return new Promise((resolve, reject) => {
    port = config.port;

    // Initialize tumbler with allowed peers and signals
    const allSignals = [...config.signals.incoming, ...config.signals.outgoing];
    initTumbler(config.peers, allSignals);

    socket = dgram.createSocket('udp4');

    // Initialize handlers with send context
    initHandlers({
      sendResponse: (target: string, targetPort: number, message: Buffer) => {
        if (socket) {
          socket.send(message, targetPort, target);
        }
      },
      config
    });

    socket.on('message', async (msg, rinfo) => {
      const message = decodeMessage(msg);
      if (!message) {
        console.error(`[synapse-relay] Failed to decode message from ${rinfo.address}:${rinfo.port}`);
        return;
      }

      if (!validateMessage(message)) {
        return;
      }

      await handleMessage(message);
    });

    socket.on('error', (err) => {
      console.error('[synapse-relay] InterLock socket error:', err.message);
      reject(err);
    });

    socket.on('listening', () => {
      const addr = socket!.address();
      console.error(`[synapse-relay] InterLock listening on port ${addr.port}`);
      resolve(socket!);
    });

    socket.bind(port);
  });
}

/**
 * Stop the InterLock socket
 */
export async function stopInterLock(): Promise<void> {
  return new Promise((resolve) => {
    if (socket) {
      socket.close(() => {
        console.error('[synapse-relay] InterLock socket closed');
        socket = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

/**
 * Send a message to a peer
 */
export function sendToPeer(targetPort: number, message: Buffer): void {
  if (socket) {
    socket.send(message, targetPort, 'localhost');
  }
}

/**
 * Send heartbeat to peers
 */
export function sendHeartbeat(peerPorts: number[]): void {
  const heartbeat = encodeMessage(SignalTypes.HEARTBEAT, 'synapse-relay', {
    status: 'operational',
    timestamp: new Date().toISOString()
  });

  for (const peerPort of peerPorts) {
    sendToPeer(peerPort, heartbeat);
  }
}

/**
 * Get the UDP socket
 */
export function getSocket(): dgram.Socket | null {
  return socket;
}

/**
 * Check if InterLock is running
 */
export function isInterLockRunning(): boolean {
  return socket !== null;
}
