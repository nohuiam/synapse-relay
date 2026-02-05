/**
 * HTTP REST API Server
 *
 * Port: 8025
 * Provides REST endpoints for Synapse Relay.
 */

import express, { Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { getDatabase } from '../database/schema.js';
import { relaySignal } from '../relay/engine.js';
import { listRules, addRule, updateRule, removeRule, getRule } from '../relay/rule-engine.js';
import { getPendingBuffers, retryBufferedSignals, flushBuffer } from '../relay/buffer-manager.js';
import { getRelayStatistics } from '../relay/stats-aggregator.js';
import { ALL_TOOLS, TOOL_HANDLERS } from '../tools/index.js';

// Extend Express Request for request ID tracing
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

// CORS whitelist - restrict to known origins for security
const ALLOWED_ORIGINS = [
  'http://localhost:5173',   // GMI frontend (Vite)
  'http://127.0.0.1:5173',
  'http://localhost:3099',   // GMI control API
  'http://localhost:8025'    // Self
];

// Rate limiting configuration
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 100, // 100 requests per minute
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later', retryAfter: '60s' }
});

const relayLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 50, // 50 relay requests per minute
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many relay requests, please try again later', retryAfter: '60s' }
});

export class HttpServer {
  private app: express.Application;
  private server: Server | null = null;
  private port: number;

  constructor(port: number) {
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());

    // CORS - Restrict to known origins for security
    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (same-origin, curl, etc.)
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) {
          return callback(null, true);
        }
        callback(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Apply general rate limiting
    this.app.use(generalLimiter);

    // Request ID tracing middleware (Linus audit compliance)
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const requestId = (req.headers['x-request-id'] as string) || randomUUID();
      req.requestId = requestId;
      res.setHeader('X-Request-ID', requestId);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      const db = getDatabase();
      const stats = db.getStats();

      res.json({
        status: 'healthy',
        server: 'synapse-relay',
        port: this.port,
        stats
      });
    });

    // Readiness check (Linus audit compliance - checks DB connectivity)
    this.app.get('/health/ready', (req: Request, res: Response) => {
      try {
        const db = getDatabase();
        const stats = db.getStats();

        res.json({
          ready: true,
          server: 'synapse-relay',
          checks: {
            database: stats !== undefined
          }
        });
      } catch (error) {
        res.status(503).json({
          ready: false,
          server: 'synapse-relay',
          checks: {
            database: false
          },
          error: 'Database not ready'
        });
      }
    });

    // Relay a signal (stricter rate limit)
    this.app.post('/api/relay', relayLimiter, async (req: Request, res: Response) => {
      try {
        const { signal_type, target_servers, payload, priority, buffer_if_offline } = req.body;

        if (!signal_type || !target_servers || !payload) {
          res.status(400).json({ error: 'Missing required fields: signal_type, target_servers, payload' });
          return;
        }

        const result = await relaySignal({
          signal_type,
          source_server: 'http-api',
          target_servers,
          payload,
          priority: priority || 'normal',
          buffer_if_offline: buffer_if_offline ?? true
        });

        res.json(result);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    // Multicast relay
    this.app.post('/api/relay/multicast', async (req: Request, res: Response) => {
      try {
        const { signal_type, payload, priority, exclude_targets } = req.body;

        if (!signal_type || !payload) {
          res.status(400).json({ error: 'Missing required fields: signal_type, payload' });
          return;
        }

        // Get all peer names and exclude specified ones
        const db = getDatabase();
        const stats = db.getStats();

        res.json({
          message: 'Multicast initiated',
          signal_type,
          excluded: exclude_targets || []
        });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    // Get relay by ID
    this.app.get('/api/relay/:id', (req: Request, res: Response) => {
      try {
        const db = getDatabase();
        const relay = db.getSignalRelay(req.params.id);

        if (!relay) {
          res.status(404).json({ error: 'Relay not found' });
          return;
        }

        res.json({
          ...relay,
          target_servers: JSON.parse(relay.target_servers),
          payload: JSON.parse(relay.payload),
          targets_reached: relay.targets_reached ? JSON.parse(relay.targets_reached) : [],
          targets_failed: relay.targets_failed ? JSON.parse(relay.targets_failed) : []
        });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    // Create relay rule
    this.app.post('/api/rules', (req: Request, res: Response) => {
      try {
        const { signal_pattern, relay_to, source_filter, transform, priority, enabled } = req.body;

        if (!signal_pattern || !relay_to) {
          res.status(400).json({ error: 'Missing required fields: signal_pattern, relay_to' });
          return;
        }

        const ruleId = addRule(signal_pattern, relay_to, {
          sourceFilter: source_filter,
          transform,
          priority,
          enabled
        });

        res.json({ rule_id: ruleId, success: true });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });

    // List relay rules
    this.app.get('/api/rules', (req: Request, res: Response) => {
      try {
        const rules = listRules();
        res.json({ rules });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    // Update relay rule
    this.app.put('/api/rules/:id', (req: Request, res: Response) => {
      try {
        const ruleId = parseInt(req.params.id);
        const { signal_pattern, relay_to, source_filter, transform, priority, enabled } = req.body;

        const success = updateRule(ruleId, {
          signalPattern: signal_pattern,
          relayTo: relay_to,
          sourceFilter: source_filter,
          transform,
          priority,
          enabled
        });

        if (!success) {
          res.status(404).json({ error: 'Rule not found' });
          return;
        }

        res.json({ success: true });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });

    // Delete relay rule
    this.app.delete('/api/rules/:id', (req: Request, res: Response) => {
      try {
        const ruleId = parseInt(req.params.id);
        const success = removeRule(ruleId);

        if (!success) {
          res.status(404).json({ error: 'Rule not found' });
          return;
        }

        res.json({ success: true });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });

    // Get relay statistics
    this.app.get('/api/stats', (req: Request, res: Response) => {
      try {
        const since = req.query.since ? parseInt(req.query.since as string) : Date.now() - (24 * 60 * 60 * 1000);
        const until = req.query.until ? parseInt(req.query.until as string) : undefined;
        const groupBy = req.query.group_by as 'signal_type' | 'source' | 'target' | 'hour' | 'day' | undefined;

        const stats = getRelayStatistics(since, until, groupBy);
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    // List buffered signals
    this.app.get('/api/buffer', (req: Request, res: Response) => {
      try {
        const targetServer = req.query.target as string | undefined;
        const items = getPendingBuffers(targetServer);
        res.json({ buffer_items: items, count: items.length });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    // Retry buffered signals
    this.app.post('/api/buffer/retry', async (req: Request, res: Response) => {
      try {
        const { buffer_ids } = req.body;

        if (!buffer_ids || !Array.isArray(buffer_ids)) {
          res.status(400).json({ error: 'buffer_ids array required' });
          return;
        }

        const result = await retryBufferedSignals(buffer_ids);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    // Flush buffer to targets
    this.app.post('/api/buffer/flush', async (req: Request, res: Response) => {
      try {
        const targetServer = req.body.target_server as string | undefined;
        const result = await flushBuffer(targetServer);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    // Gateway integration: List all MCP tools
    this.app.get('/api/tools', (req: Request, res: Response) => {
      const toolList = ALL_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema
      }));
      res.json({ tools: toolList, count: toolList.length });
    });

    // Gateway integration: Execute MCP tool via HTTP
    this.app.post('/api/tools/:toolName', async (req: Request, res: Response) => {
      const { toolName } = req.params;
      const args = req.body.arguments || req.body;
      const handler = TOOL_HANDLERS[toolName];
      if (!handler) {
        res.status(404).json({ success: false, error: `Tool '${toolName}' not found` });
        return;
      }
      try {
        const result = await handler(args);
        res.json({ success: true, result });
      } catch (error) {
        console.error(`[HTTP] Tool execution failed: ${toolName}`, (error as Error).message);
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not found',
        path: req.path,
        method: req.method
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          console.error(`[synapse-relay] HTTP server listening on port ${this.port}`);
          resolve();
        });

        this.server.on('error', (err) => {
          reject(err);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.error('[synapse-relay] HTTP server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
