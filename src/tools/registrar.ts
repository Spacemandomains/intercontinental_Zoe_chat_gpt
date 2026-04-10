import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z, type ZodRawShape } from 'zod';
import type { ToolContext, ToolHandler } from './types.js';
import type { ToolResultShape } from './response.js';

export interface ToolRegistration<Shape extends ZodRawShape> {
  name: string;
  title: string;
  description: string;
  inputSchema: Shape;
  handler: (args: z.infer<z.ZodObject<Shape>>) => Promise<ToolResultShape>;
}

/**
 * Registers a tool with the MCP server AND captures the validated handler into
 * the shared `ctx.handlers` map so the REST /actions mirror can call the same
 * code path without re-dispatching through JSON-RPC.
 */
export function registerTool<Shape extends ZodRawShape>(
  server: McpServer,
  ctx: ToolContext,
  reg: ToolRegistration<Shape>,
): void {
  const { name, title, description, inputSchema, handler } = reg;

  // MCP registration: the server does its own zod validation via inputSchema.
  // The SDK's callback type is very wide; our ToolResultShape satisfies the
  // structural requirements (content[] + optional structuredContent), but the
  // exact conditional type is noisy, so cast via unknown at the boundary.
  server.registerTool(
    name,
    { title, description, inputSchema },
    handler as unknown as Parameters<typeof server.registerTool>[2],
  );

  // REST-mirror registration: wrap the handler with a zod parse so the /actions
  // endpoint gets the same validation semantics as the MCP path.
  const parser = z.object(inputSchema);
  const wrapped: ToolHandler = async (raw) => {
    const parsed = parser.parse(raw ?? {});
    return handler(parsed as z.infer<z.ZodObject<Shape>>);
  };
  ctx.handlers.set(name, wrapped);
}
