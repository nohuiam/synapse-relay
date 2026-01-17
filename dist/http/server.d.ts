/**
 * HTTP REST API Server
 *
 * Port: 8025
 * Provides REST endpoints for Synapse Relay.
 */
export declare class HttpServer {
    private app;
    private server;
    private port;
    constructor(port: number);
    private setupMiddleware;
    private setupRoutes;
    start(): Promise<void>;
    stop(): Promise<void>;
}
//# sourceMappingURL=server.d.ts.map