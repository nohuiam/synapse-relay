/**
 * InterLock UDP Socket
 *
 * Handles UDP communication for the mesh network.
 * Updated to use @bop/interlock shared package for peer management.
 */

import dgram from 'dgram';
import { InterlockSocket as SharedSocket } from '@bop/interlock';
import type { InterlockConfig as SharedConfig } from '@bop/interlock';
import { decodeMessage, encodeMessage, SignalTypes } from './protocol.js';
import { validateMessage, initTumbler } from './tumbler.js';
import { handleMessage, initHandlers } from './handlers.js';
import type { InterlockConfig } from '../types.js';

let sharedSocket: SharedSocket | null = null;
let localSocket: dgram.Socket | null = null;
let port: number = 3025;

/**
 * Start the InterLock UDP socket
 */
export async function startInterLock(config: InterlockConfig): Promise<dgram.Socket> {
  port = config.port;

  // Initialize tumbler with allowed peers and signals
  const allSignals = [...config.signals.incoming, ...config.signals.outgoing];
  initTumbler(config.peers, allSignals);

  // Transform peer_ports to shared package format
  const peersConfig: Record<string, { host: string; port: number }> = {};
  for (const [serverId, peerPort] of Object.entries(config.peer_ports)) {
    peersConfig[serverId] = { host: '127.0.0.1', port: peerPort };
  }

  // Create shared socket config
  // Note: server_id and heartbeat may exist in config JSON but not in TypeScript type
  const rawConfig = config as unknown as Record<string, unknown>;
  const sharedConfig: SharedConfig = {
    port: config.port,
    serverId: (rawConfig.server_id as string) || 'synapse-relay',
    peers: peersConfig,
    heartbeat: {
      interval: ((rawConfig.heartbeat as Record<string, number>)?.interval) || 30000,
      timeout: ((rawConfig.heartbeat as Record<string, number>)?.timeout) || 90000
    }
  };

  // Create shared socket for peer management
  sharedSocket = new SharedSocket(sharedConfig);

  // Initialize handlers with send context
  initHandlers({
    sendResponse: (target: string, targetPort: number, message: Buffer) => {
      if (localSocket) {
        localSocket.send(message, targetPort, target);
      }
    },
    config
  });

  // Listen for signals from shared socket
  sharedSocket.on('signal', async (signal, rinfo) => {
    // Convert shared signal format to local InterLockMessage format
    const message = {
      signalType: signal.type,
      sender: signal.data.serverId,
      version: signal.version,
      timestamp: signal.timestamp,
      payload: signal.data
    };

    if (!validateMessage(message)) {
      return;
    }

    await handleMessage(message);
  });

  // Start the shared socket
  await sharedSocket.start();

  // Get internal socket reference for compatibility
  localSocket = (sharedSocket as unknown as { socket: dgram.Socket }).socket;

  console.error(`[synapse-relay] InterLock listening on port ${port}`);
  return localSocket;
}

/**
 * Stop the InterLock socket
 */
export async function stopInterLock(): Promise<void> {
  if (sharedSocket) {
    await sharedSocket.stop();
    console.error('[synapse-relay] InterLock socket closed');
    sharedSocket = null;
    localSocket = null;
  }
}

/**
 * Send a message to a peer
 */
export function sendToPeer(targetPort: number, message: Buffer): void {
  if (localSocket) {
    localSocket.send(message, targetPort, 'localhost');
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
  return localSocket;
}

/**
 * Check if InterLock is running
 */
export function isInterLockRunning(): boolean {
  return sharedSocket !== null;
}

/**
 * Get socket statistics from shared package
 */
export function getSocketStats() {
  return sharedSocket?.getStats() || null;
}
