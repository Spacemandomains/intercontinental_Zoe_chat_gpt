import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './types.js';

import { registerListVideos } from './listVideos.js';
import { registerGetVideoDetails } from './getVideoDetails.js';
import { registerGetVideoTranscript } from './getVideoTranscript.js';
import { registerSearchVideos } from './searchVideos.js';
import { registerListDestinations } from './listDestinations.js';
import { registerGetDestinationOverview } from './getDestinationOverview.js';
import { registerListServices } from './listServices.js';
import { registerGetServiceDetails } from './getServiceDetails.js';
import { registerListProducts } from './listProducts.js';
import { registerListSupportOptions } from './listSupportOptions.js';
import { registerStartLead } from './startLead.js';

export function registerAllTools(server: McpServer, ctx: ToolContext): void {
  // YouTube (4)
  registerListVideos(server, ctx);
  registerGetVideoDetails(server, ctx);
  registerGetVideoTranscript(server, ctx);
  registerSearchVideos(server, ctx);

  // Knowledge base (2)
  registerListDestinations(server, ctx);
  registerGetDestinationOverview(server, ctx);

  // Sales funnel (5)
  registerListServices(server, ctx);
  registerGetServiceDetails(server, ctx);
  registerListProducts(server, ctx);
  registerListSupportOptions(server, ctx);
  registerStartLead(server, ctx);
}

/** Stable list of tool names for the REST /actions mirror and OpenAPI generator. */
export const ALL_TOOL_NAMES = [
  'list_videos',
  'get_video_details',
  'get_video_transcript',
  'search_videos',
  'list_destinations',
  'get_destination_overview',
  'list_services',
  'get_service_details',
  'list_products',
  'list_support_options',
  'start_lead',
] as const;

export type ToolName = (typeof ALL_TOOL_NAMES)[number];
