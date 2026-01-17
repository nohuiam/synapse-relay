/**
 * HTTP REST API Server
 *
 * Port: 8025
 * Provides REST endpoints for Synapse Relay.
 */
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { getDatabase } from '../database/schema.js';
import { relaySignal } from '../relay/engine.js';
import { listRules, addRule, updateRule, removeRule } from '../relay/rule-engine.js';
import { getPendingBuffers, retryBufferedSignals, flushBuffer } from '../relay/buffer-manager.js';
import { getRelayStatistics } from '../relay/stats-aggregator.js';
import { ALL_TOOLS, TOOL_HANDLERS } from '../tools/index.js';
// CORS whitelist - restrict to known origins for security
const ALLOWED_ORIGINS = [
    'http://localhost:5173', // GMI frontend (Vite)
    'http://127.0.0.1:5173',
    'http://localhost:3099', // GMI control API
    'http://localhost:8025' // Self
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
    app;
    server = null;
    port;
    constructor(port) {
        this.port = port;
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }
    setupMiddleware() {
        this.app.use(express.json());
        // CORS - Restrict to known origins for security
        this.app.use(cors({
            origin: (origin, callback) => {
                // Allow requests with no origin (same-origin, curl, etc.)
                if (!origin)
                    return callback(null, true);
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
    }
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            const db = getDatabase();
            const stats = db.getStats();
            res.json({
                status: 'healthy',
                server: 'synapse-relay',
                port: this.port,
                stats
            });
        });
        // Relay a signal (stricter rate limit)
        this.app.post('/api/relay', relayLimiter, async (req, res) => {
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
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Multicast relay
        this.app.post('/api/relay/multicast', async (req, res) => {
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
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Get relay by ID
        this.app.get('/api/relay/:id', (req, res) => {
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
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Create relay rule
        this.app.post('/api/rules', (req, res) => {
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
            }
            catch (error) {
                res.status(400).json({ error: error.message });
            }
        });
        // List relay rules
        this.app.get('/api/rules', (req, res) => {
            try {
                const rules = listRules();
                res.json({ rules });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Update relay rule
        this.app.put('/api/rules/:id', (req, res) => {
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
            }
            catch (error) {
                res.status(400).json({ error: error.message });
            }
        });
        // Delete relay rule
        this.app.delete('/api/rules/:id', (req, res) => {
            try {
                const ruleId = parseInt(req.params.id);
                const success = removeRule(ruleId);
                if (!success) {
                    res.status(404).json({ error: 'Rule not found' });
                    return;
                }
                res.json({ success: true });
            }
            catch (error) {
                res.status(400).json({ error: error.message });
            }
        });
        // Get relay statistics
        this.app.get('/api/stats', (req, res) => {
            try {
                const since = req.query.since ? parseInt(req.query.since) : Date.now() - (24 * 60 * 60 * 1000);
                const until = req.query.until ? parseInt(req.query.until) : undefined;
                const groupBy = req.query.group_by;
                const stats = getRelayStatistics(since, until, groupBy);
                res.json(stats);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // List buffered signals
        this.app.get('/api/buffer', (req, res) => {
            try {
                const targetServer = req.query.target;
                const items = getPendingBuffers(targetServer);
                res.json({ buffer_items: items, count: items.length });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Retry buffered signals
        this.app.post('/api/buffer/retry', async (req, res) => {
            try {
                const { buffer_ids } = req.body;
                if (!buffer_ids || !Array.isArray(buffer_ids)) {
                    res.status(400).json({ error: 'buffer_ids array required' });
                    return;
                }
                const result = await retryBufferedSignals(buffer_ids);
                res.json(result);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Flush buffer to targets
        this.app.post('/api/buffer/flush', async (req, res) => {
            try {
                const targetServer = req.body.target_server;
                const result = await flushBuffer(targetServer);
                res.json(result);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Gateway integration: List all MCP tools
        this.app.get('/api/tools', (req, res) => {
            const toolList = ALL_TOOLS.map((t) => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema
            }));
            res.json({ tools: toolList, count: toolList.length });
        });
        // Gateway integration: Execute MCP tool via HTTP
        this.app.post('/api/tools/:toolName', async (req, res) => {
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
            }
            catch (error) {
                console.error(`[HTTP] Tool execution failed: ${toolName}`, error.message);
                res.status(500).json({ success: false, error: error.message });
            }
        });
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Not found',
                path: req.path,
                method: req.method
            });
        });
    }
    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.port, () => {
                    console.error(`[synapse-relay] HTTP server listening on port ${this.port}`);
                    resolve();
                });
                this.server.on('error', (err) => {
                    reject(err);
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    async stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.error('[synapse-relay] HTTP server stopped');
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
}
//# sourceMappingURL=server.js.map