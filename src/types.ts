/**
 * Type Definitions for Synapse Relay
 */

// Signal Priority
export type SignalPriority = 'low' | 'normal' | 'high' | 'urgent';

// Buffer Status
export type BufferStatus = 'pending' | 'delivered' | 'expired' | 'failed';

// Rule Action
export type RuleAction = 'add' | 'update' | 'remove' | 'list';

// Buffer Action
export type BufferAction = 'list' | 'retry' | 'clear' | 'flush';

// Group By Options
export type GroupByOption = 'signal_type' | 'source' | 'target' | 'hour' | 'day';

// Database Types
export interface DbSignalRelay {
  id: string;
  signal_type: number;
  source_server: string;
  target_servers: string; // JSON array
  payload: string; // JSON
  priority: SignalPriority;
  relayed_at: number;
  success: number;
  targets_reached: string | null; // JSON array
  targets_failed: string | null; // JSON array
  latency_ms: number | null;
  error_message: string | null;
}

export interface DbRelayRule {
  id: number;
  signal_pattern: number;
  source_filter: string | null;
  relay_to: string; // JSON array
  transform: string | null; // JSON
  priority: number;
  enabled: number;
  created_at: number;
  updated_at: number | null;
  match_count: number;
}

export interface DbSignalBuffer {
  id: string;
  signal_type: number;
  source_server: string;
  target_server: string;
  payload: string; // JSON
  priority: SignalPriority;
  buffered_at: number;
  retry_count: number;
  last_retry_at: number | null;
  max_retries: number;
  expires_at: number | null;
  status: BufferStatus;
}

export interface DbRelayStats {
  id: number;
  period_start: number;
  signal_type: number | null;
  source_server: string | null;
  target_server: string | null;
  total_relayed: number;
  success_count: number;
  failure_count: number;
  avg_latency_ms: number | null;
  max_latency_ms: number | null;
  buffered_count: number;
}

// Tool Input Types
export interface RelaySignalInput {
  signal_type: number;
  target_servers: string[];
  payload: Record<string, unknown>;
  priority?: SignalPriority;
  retry_on_fail?: boolean;
  buffer_if_offline?: boolean;
}

export interface ConfigureRelayInput {
  action: RuleAction;
  rule_id?: number;
  signal_pattern?: number;
  source_filter?: string;
  relay_to?: string[];
  transform?: Record<string, unknown>;
  enabled?: boolean;
  priority?: number;
}

export interface GetRelayStatsInput {
  since?: number;
  until?: number;
  group_by?: GroupByOption;
  include_failures?: boolean;
}

export interface BufferSignalsInput {
  action: BufferAction;
  target_server?: string;
  signal_type?: number;
  max_age_hours?: number;
  buffer_ids?: string[];
}

// Tool Output Types
export interface RelaySignalOutput {
  relay_id: string;
  relayed: boolean;
  targets_reached: string[];
  targets_buffered: string[];
  latency_ms: number;
}

export interface RelayRule {
  id: number;
  signal_pattern: number;
  source_filter: string | null;
  relay_to: string[];
  transform: Record<string, unknown> | null;
  priority: number;
  enabled: boolean;
  created_at: string;
  updated_at: string | null;
  match_count: number;
}

export interface ConfigureRelayOutput {
  rule_id: number;
  action: RuleAction;
  success: boolean;
  rules?: RelayRule[];
}

export interface GroupStats {
  count: number;
  success_rate: number;
  avg_latency: number;
}

export interface GetRelayStatsOutput {
  total_relayed: number;
  success_rate: number;
  avg_latency_ms: number;
  by_group: Record<string, GroupStats>;
  buffer_stats: {
    pending: number;
    delivered: number;
    expired: number;
  };
}

export interface BufferItem {
  id: string;
  signal_type: number;
  source_server: string;
  target_server: string;
  payload: Record<string, unknown>;
  priority: SignalPriority;
  buffered_at: string;
  retry_count: number;
  status: BufferStatus;
}

export interface BufferSignalsOutput {
  action: BufferAction;
  affected_count: number;
  buffer_items?: BufferItem[];
}

// Internal Types
export interface RelayRequest {
  signal_type: number;
  source_server: string;
  target_servers: string[];
  payload: Record<string, unknown>;
  priority: SignalPriority;
  buffer_if_offline: boolean;
}

export interface RelayResult {
  relay_id: string;
  relayed: boolean;
  targets_reached: string[];
  targets_failed: string[];
  targets_buffered: string[];
  latency_ms: number;
}

export interface InterlockConfig {
  port: number;
  peers: string[];
  peer_ports: Record<string, number>;
  signals: {
    incoming: string[];
    outgoing: string[];
  };
  buffer_config: {
    max_size: number;
    ttl_hours: number;
    retry_intervals_ms: number[];
  };
  stats_aggregation_interval_ms: number;
}
