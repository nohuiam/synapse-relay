/**
 * Relay Engine
 *
 * Core relay logic for signal routing.
 */
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/schema.js';
import { bufferSignal } from './buffer-manager.js';
import { matchRules, applyTransform } from './rule-engine.js';
let config = null;
let udpSocket = null;
/**
 * Initialize the relay engine
 */
export function initRelayEngine(cfg, socket) {
    config = cfg;
    udpSocket = socket;
}
/**
 * Relay a signal to target servers
 */
export async function relaySignal(request) {
    const startTime = Date.now();
    const relayId = uuidv4();
    const db = getDatabase();
    const targetsReached = [];
    const targetsFailed = [];
    const targetsBuffered = [];
    // Check for matching rules and apply any transforms
    const rules = matchRules(request.signal_type, request.source_server);
    let payload = request.payload;
    for (const rule of rules) {
        if (rule.transform) {
            const transform = JSON.parse(rule.transform);
            payload = applyTransform(payload, transform);
        }
    }
    // Send to each target
    const results = await Promise.allSettled(request.target_servers.map(target => sendToTarget(target, request.signal_type, payload, request.priority)));
    results.forEach((result, i) => {
        const target = request.target_servers[i];
        if (result.status === 'fulfilled' && result.value) {
            targetsReached.push(target);
        }
        else {
            targetsFailed.push(target);
            if (request.buffer_if_offline) {
                bufferSignal(request.signal_type, request.source_server, target, payload, request.priority);
                targetsBuffered.push(target);
            }
        }
    });
    const latencyMs = Date.now() - startTime;
    // Record relay in database
    db.insertSignalRelay({
        id: relayId,
        signal_type: request.signal_type,
        source_server: request.source_server,
        target_servers: JSON.stringify(request.target_servers),
        payload: JSON.stringify(payload),
        priority: request.priority,
        relayed_at: Date.now(),
        success: targetsReached.length > 0 ? 1 : 0,
        targets_reached: JSON.stringify(targetsReached),
        targets_failed: JSON.stringify(targetsFailed),
        latency_ms: latencyMs,
        error_message: null
    });
    return {
        relay_id: relayId,
        relayed: targetsReached.length > 0,
        targets_reached: targetsReached,
        targets_failed: targetsFailed,
        targets_buffered: targetsBuffered,
        latency_ms: latencyMs
    };
}
/**
 * Send signal to a specific target
 */
async function sendToTarget(target, signalType, payload, priority) {
    return new Promise((resolve) => {
        if (!config || !udpSocket) {
            resolve(false);
            return;
        }
        const targetPort = config.peer_ports[target];
        if (!targetPort) {
            console.error(`[synapse-relay] Unknown target: ${target}`);
            resolve(false);
            return;
        }
        const message = encodeRelayMessage(signalType, 'synapse-relay', payload, priority);
        udpSocket.send(message, targetPort, 'localhost', (err) => {
            if (err) {
                console.error(`[synapse-relay] Failed to send to ${target}:${targetPort}:`, err.message);
                resolve(false);
            }
            else {
                resolve(true);
            }
        });
    });
}
/**
 * Encode a relay message for UDP transmission
 */
function encodeRelayMessage(signalType, sender, payload, priority) {
    const message = {
        type: signalType,
        sender,
        payload,
        priority,
        timestamp: Date.now()
    };
    return Buffer.from(JSON.stringify(message), 'utf-8');
}
/**
 * Get relay engine status
 */
export function getRelayEngineStatus() {
    return {
        initialized: config !== null && udpSocket !== null,
        peers_count: config ? Object.keys(config.peer_ports).length : 0
    };
}
/**
 * Multicast signal to multiple targets
 */
export async function multicastSignal(signalType, sourceServer, payload, priority = 'normal', excludeTargets = []) {
    if (!config) {
        return {
            relay_id: uuidv4(),
            relayed: false,
            targets_reached: [],
            targets_failed: [],
            targets_buffered: [],
            latency_ms: 0
        };
    }
    const targets = Object.keys(config.peer_ports).filter(t => !excludeTargets.includes(t));
    return relaySignal({
        signal_type: signalType,
        source_server: sourceServer,
        target_servers: targets,
        payload,
        priority,
        buffer_if_offline: true
    });
}
//# sourceMappingURL=engine.js.map