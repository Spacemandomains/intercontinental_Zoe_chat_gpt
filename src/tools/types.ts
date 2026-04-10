import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CanonicalData } from '../data/types.js';
import type { Catalog } from '../youtube/catalog.js';
import type { ToolResultShape } from './response.js';

/** Signature of a tool handler after input has been validated. */
export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResultShape>;

/**
 * Shared context passed to every tool registration function.
 * Holds the loaded canonical data, the hydrated YouTube catalog, and
 * a shared `handlers` map that lets the REST /actions mirror invoke the
 * same handlers the MCP transport uses — without going through the
 * JSON-RPC plumbing twice.
 */
export interface ToolContext {
  data: CanonicalData;
  catalog: Catalog;
  /** Map from tool name to validated handler, populated during registration. */
  handlers: Map<string, ToolHandler>;
  /** Forces a rebuild of the YouTube catalog from the per-destination playlists. */
  refreshCatalog: () => Promise<void>;
  /** Reloads canonical data from disk. */
  reloadData: () => Promise<void>;
}

export type ToolRegistrar = (server: McpServer, ctx: ToolContext) => void;

/** A single structured next-step CTA returned in every tool payload. */
export interface NextStep {
  label: string;
  description?: string;
  tool?: string;
  args?: Record<string, unknown>;
  url?: string;
}
