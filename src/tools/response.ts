import type { NextStep } from './types.js';

/** MCP CallToolResult content block shape. */
interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolPayload {
  ok: boolean;
  notFound?: boolean;
  nextSteps?: NextStep[];
  [key: string]: unknown;
}

export interface ToolResultShape {
  content: TextContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/**
 * Serializes a tool payload into the MCP CallToolResult shape with both
 * structured content (for clients that understand it) and a JSON text
 * content block (universally supported). Ensures `ok`, `notFound`, and
 * `nextSteps` are present in every response in a predictable order.
 */
export function toolResult(payload: ToolPayload): ToolResultShape {
  const { ok, notFound, nextSteps, ...rest } = payload;
  const final: Record<string, unknown> = {
    ok,
    ...(notFound ? { notFound: true } : {}),
    nextSteps: nextSteps ?? [],
    ...rest,
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(final, null, 2),
      },
    ],
    structuredContent: final,
  };
}

/** Convenience: mark a tool as returning a "not found" answer with a helpful nextSteps menu. */
export function notFoundResult(
  reason: string,
  extraNextSteps: NextStep[] = [],
): ToolResultShape {
  return toolResult({
    ok: true,
    notFound: true,
    reason,
    nextSteps: [
      {
        label: 'Chat with Zoe directly',
        description: 'Open a live chat on Crisp to get a personal answer.',
        tool: 'get_service_details',
        args: { serviceId: 'consultation' },
      },
      {
        label: 'Ask to be contacted by email',
        description: 'Zoe will follow up personally.',
        tool: 'start_lead',
        args: { leadType: 'general' },
      },
      ...extraNextSteps,
    ],
  });
}
