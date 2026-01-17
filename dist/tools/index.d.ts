/**
 * Synapse Relay - Gateway Integration Index
 * Maps all MCP tools for HTTP gateway exposure
 */
import { Tool } from '@modelcontextprotocol/sdk/types.js';
/**
 * All MCP tool definitions for gateway listing
 */
export declare const ALL_TOOLS: Tool[];
/**
 * Tool handlers mapped by name for gateway execution
 */
export declare const TOOL_HANDLERS: Record<string, (args: unknown) => Promise<unknown>>;
declare const _default: {
    ALL_TOOLS: {
        inputSchema: {
            [x: string]: unknown;
            type: "object";
            properties?: {
                [x: string]: object;
            } | undefined;
            required?: string[] | undefined;
        };
        name: string;
        description?: string | undefined;
        outputSchema?: {
            [x: string]: unknown;
            type: "object";
            properties?: {
                [x: string]: object;
            } | undefined;
            required?: string[] | undefined;
        } | undefined;
        annotations?: {
            title?: string | undefined;
            readOnlyHint?: boolean | undefined;
            destructiveHint?: boolean | undefined;
            idempotentHint?: boolean | undefined;
            openWorldHint?: boolean | undefined;
        } | undefined;
        execution?: {
            taskSupport?: "optional" | "required" | "forbidden" | undefined;
        } | undefined;
        _meta?: {
            [x: string]: unknown;
        } | undefined;
        icons?: {
            src: string;
            mimeType?: string | undefined;
            sizes?: string[] | undefined;
            theme?: "light" | "dark" | undefined;
        }[] | undefined;
        title?: string | undefined;
    }[];
    TOOL_HANDLERS: Record<string, (args: unknown) => Promise<unknown>>;
};
export default _default;
//# sourceMappingURL=index.d.ts.map