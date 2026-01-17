/**
 * Synapse Relay - Gateway Integration Index
 * Maps all MCP tools for HTTP gateway exposure
 */

import { RELAY_SIGNAL_TOOL, handleRelaySignal } from './relay-signal.js';
import { BUFFER_SIGNALS_TOOL, handleBufferSignals } from './buffer-signals.js';
import { CONFIGURE_RELAY_TOOL, handleConfigureRelay } from './configure-relay.js';
import { GET_RELAY_STATS_TOOL, handleGetRelayStats } from './get-relay-stats.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * All MCP tool definitions for gateway listing
 */
export const ALL_TOOLS: Tool[] = [
  RELAY_SIGNAL_TOOL,
  BUFFER_SIGNALS_TOOL,
  CONFIGURE_RELAY_TOOL,
  GET_RELAY_STATS_TOOL
];

/**
 * Tool handlers mapped by name for gateway execution
 */
export const TOOL_HANDLERS: Record<string, (args: unknown) => Promise<unknown>> = {
  relay_signal: async (args) => handleRelaySignal(args),
  buffer_signals: async (args) => handleBufferSignals(args),
  configure_relay: async (args) => handleConfigureRelay(args),
  get_relay_stats: async (args) => handleGetRelayStats(args)
};

export default { ALL_TOOLS, TOOL_HANDLERS };
