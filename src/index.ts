#!/usr/bin/env node
/**
 * Synapse Relay MCP Server
 *
 * Server #25 in the BOP/Imminence ecosystem.
 * Neural packet routing system for the InterLock mesh.
 *
 * Ports:
 * - MCP: stdio (stdin/stdout)
 * - InterLock: UDP 3025
 * - HTTP: 8025
 * - WebSocket: 9025
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Database
import { initDatabase, closeDatabase } from './database/schema.js';

// Relay engine
import { initRelayEngine } from './relay/engine.js';
import { setDeliveryCallback, processBuffer } from './relay/buffer-manager.js';
import { startStatsAggregation, stopStatsAggregation } from './relay/stats-aggregator.js';

// Tools
import { RELAY_SIGNAL_TOOL, handleRelaySignal } from './tools/relay-signal.js';
import { CONFIGURE_RELAY_TOOL, handleConfigureRelay } from './tools/configure-relay.js';
import { GET_RELAY_STATS_TOOL, handleGetRelayStats } from './tools/get-relay-stats.js';
import { BUFFER_SIGNALS_TOOL, handleBufferSignals } from './tools/buffer-signals.js';

// HTTP and WebSocket servers
import { HttpServer } from './http/server.js';
import { WebSocketService } from './websocket/server.js';

// InterLock
import { startInterLock, stopInterLock, sendToPeer, sendHeartbeat } from './interlock/index.js';
import type { InterlockConfig, DbSignalBuffer } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load InterLock config
function loadInterLockConfig(): InterlockConfig {
  try {
    const configPath = join(__dirname, '..', 'config', 'interlock.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return {
      port: config.port || 3025,
      peers: config.peers || [],
      peer_ports: config.peer_ports || {},
      signals: config.signals || { incoming: [], outgoing: [] },
      buffer_config: config.buffer_config || {
        max_size: 10000,
        ttl_hours: 24,
        retry_intervals_ms: [1000, 5000, 15000]
      },
      stats_aggregation_interval_ms: config.stats_aggregation_interval_ms || 3600000
    };
  } catch {
    return {
      port: 3025,
      peers: [],
      peer_ports: {},
      signals: { incoming: [], outgoing: [] },
      buffer_config: {
        max_size: 10000,
        ttl_hours: 24,
        retry_intervals_ms: [1000, 5000, 15000]
      },
      stats_aggregation_interval_ms: 3600000
    };
  }
}

// All tools
const TOOLS = [
  RELAY_SIGNAL_TOOL,
  CONFIGURE_RELAY_TOOL,
  GET_RELAY_STATS_TOOL,
  BUFFER_SIGNALS_TOOL
];

class SynapseRelayServer {
  private server: Server;
  private httpServer: HttpServer;
  private wsService: WebSocketService;
  private bufferProcessorInterval: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private config: InterlockConfig;

  constructor() {
    this.config = loadInterLockConfig();

    this.server = new Server(
      {
        name: 'synapse-relay',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.httpServer = new HttpServer(8025);
    this.wsService = new WebSocketService(9025);

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS
    }));

    // Call tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result: unknown;

        switch (name) {
          case 'relay_signal':
            result = await handleRelaySignal(args);
            break;

          case 'configure_relay':
            result = handleConfigureRelay(args);
            break;

          case 'get_relay_stats':
            result = handleGetRelayStats(args);
            break;

          case 'buffer_signals':
            result = await handleBufferSignals(args);
            break;

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        if (error instanceof McpError) throw error;

        const message = error instanceof Error ? error.message : String(error);
        throw new McpError(ErrorCode.InternalError, message);
      }
    });
  }

  async start(): Promise<void> {
    // Initialize database
    initDatabase();
    console.error('[synapse-relay] Database initialized');

    // Start InterLock mesh
    try {
      const socket = await startInterLock(this.config);
      console.error('[synapse-relay] InterLock mesh started on port 3025');

      // Initialize relay engine with socket
      initRelayEngine(this.config, socket);

      // Set up delivery callback for buffer manager
      setDeliveryCallback(async (buffer: DbSignalBuffer) => {
        const targetPort = this.config.peer_ports[buffer.target_server];
        if (!targetPort) return false;

        return new Promise((resolve) => {
          const payload = JSON.parse(buffer.payload) as Record<string, unknown>;
          const message = Buffer.from(JSON.stringify({
            type: buffer.signal_type,
            sender: 'synapse-relay',
            payload,
            timestamp: Date.now()
          }), 'utf-8');

          socket.send(message, targetPort, 'localhost', (err) => {
            if (err) {
              resolve(false);
            } else {
              this.wsService.emitRelaySent(buffer.id, [buffer.target_server], 0);
              resolve(true);
            }
          });
        });
      });

      // Start heartbeat timer
      const peerPorts = Object.values(this.config.peer_ports) as number[];
      this.heartbeatTimer = setInterval(() => {
        sendHeartbeat(peerPorts);
      }, 30000);
      sendHeartbeat(peerPorts); // Send initial heartbeat
    } catch (error) {
      console.error('[synapse-relay] InterLock failed to start:', error);
    }

    // Start HTTP server
    try {
      await this.httpServer.start();
    } catch (error) {
      console.error('[synapse-relay] HTTP server failed to start:', error);
    }

    // Start WebSocket server
    try {
      await this.wsService.start();
    } catch (error) {
      console.error('[synapse-relay] WebSocket server failed to start:', error);
    }

    // Start buffer processor interval
    this.bufferProcessorInterval = setInterval(async () => {
      const result = await processBuffer();
      if (result.expired > 0) {
        this.wsService.emitBufferExpired(result.expired);
      }
    }, 5000); // Process buffer every 5 seconds
    console.error('[synapse-relay] Buffer processor started');

    // Start stats aggregation
    startStatsAggregation(this.config.stats_aggregation_interval_ms);
    console.error('[synapse-relay] Stats aggregation started');

    // Start MCP server
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[synapse-relay] MCP server started');
  }

  async stop(): Promise<void> {
    console.error('[synapse-relay] Shutting down...');

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.bufferProcessorInterval) {
      clearInterval(this.bufferProcessorInterval);
      this.bufferProcessorInterval = null;
    }

    stopStatsAggregation();
    await stopInterLock();
    await this.wsService.stop();
    await this.httpServer.stop();
    closeDatabase();

    console.error('[synapse-relay] Shutdown complete');
  }
}

// Main entry point
const server = new SynapseRelayServer();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.stop();
  process.exit(0);
});

// Start server
server.start().catch((error) => {
  console.error('[synapse-relay] Failed to start:', error);
  process.exit(1);
});
