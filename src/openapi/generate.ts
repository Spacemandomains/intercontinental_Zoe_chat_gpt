import { z, type ZodRawShape } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { SERVER_NAME, SERVER_VERSION } from '../server.js';
import { ALL_TOOL_NAMES, type ToolName } from '../tools/index.js';
import {
  listVideosInput,
  getVideoDetailsInput,
  getVideoTranscriptInput,
  searchVideosInput,
  listDestinationsInput,
  getDestinationOverviewInput,
  listServicesInput,
  getServiceDetailsInput,
  listProductsInput,
  listSupportOptionsInput,
  startLeadInput,
} from '../tools/schemas.js';

/**
 * Describes each tool in terms ChatGPT Custom GPT Actions can consume:
 * an operationId, a short human summary, and the zod input shape. The
 * generator converts each to a JSON Schema and wires up a POST path.
 */
interface ToolSpec {
  name: ToolName;
  summary: string;
  description: string;
  input: ZodRawShape;
}

const TOOL_SPECS: readonly ToolSpec[] = [
  {
    name: 'list_videos',
    summary: "List Zoe's travel videos",
    description:
      "List videos from Intercontinental Zoe's unified travel catalog across all per-country playlists. Use destinationId to scope to a single country. Return only values from the server's canonical data.",
    input: listVideosInput,
  },
  {
    name: 'get_video_details',
    summary: 'Get full details for a video',
    description:
      'Return full metadata (title, description, duration, statistics, parsed chapters, destinations) for a video in the canonical catalog.',
    input: getVideoDetailsInput,
  },
  {
    name: 'get_video_transcript',
    summary: 'Fetch a video transcript',
    description:
      "Return the public caption transcript for a video in Zoe's catalog — segments and full text. notFound when no captions are available.",
    input: getVideoTranscriptInput,
  },
  {
    name: 'search_videos',
    summary: "Search Zoe's travel catalog",
    description:
      "Search Zoe's unified video catalog by keyword across title, description, and tags. Optionally scope to one destinationId.",
    input: searchVideosInput,
  },
  {
    name: 'list_destinations',
    summary: 'List destinations Zoe has visited',
    description:
      'List the destinations Zoe has visited, optionally filtered by region, country, or continent.',
    input: listDestinationsInput,
  },
  {
    name: 'get_destination_overview',
    summary: 'Full overview for a destination',
    description:
      'Return a bundled overview for a destination — summary, recent videos, the matching guide, available rentals, recommended services, and tips. First call when a user wants to plan a trip.',
    input: getDestinationOverviewInput,
  },
  {
    name: 'list_services',
    summary: "List Zoe's travel services",
    description:
      "List all travel services Zoe offers with name, tagline, price, and duration. Prices are exact and canonical.",
    input: listServicesInput,
  },
  {
    name: 'get_service_details',
    summary: 'Get details for a service',
    description:
      "Return full details for a specific service — description, what's included, deliverables, price, PayPal link, Crisp chat link, and the next-step CTA.",
    input: getServiceDetailsInput,
  },
  {
    name: 'list_products',
    summary: 'List products, rentals, and guides',
    description:
      'List products Zoe offers — guides, rentals, or merchandise — optionally filtered by destination.',
    input: listProductsInput,
  },
  {
    name: 'list_support_options',
    summary: 'Ways to support Zoe',
    description:
      'List all the ways a visitor can support Intercontinental Zoe — donations, Patreon, merchandise, affiliates.',
    input: listSupportOptionsInput,
  },
  {
    name: 'start_lead',
    summary: 'Capture a visitor lead for Zoe',
    description:
      "Capture a visitor's contact info and interest. Sends an email to Zoe via Resend and returns a PayPal link (for service leads) and Crisp chat link.",
    input: startLeadInput,
  },
];

// Sanity check: specs must cover exactly the same tools the server registers.
// Catches drift if a new tool is added to tools/index but not here.
{
  const specNames = new Set(TOOL_SPECS.map((s) => s.name));
  for (const name of ALL_TOOL_NAMES) {
    if (!specNames.has(name)) {
      throw new Error(`openapi/generate: missing spec for tool "${name}"`);
    }
  }
}

/**
 * Generates an OpenAPI 3.1 document describing the REST /actions mirror,
 * suitable for import into a ChatGPT Custom GPT Action.
 */
export function generateOpenApiDocument(
  baseUrl: string,
  bearerRequired: boolean,
): Record<string, unknown> {
  const paths: Record<string, unknown> = {};

  for (const spec of TOOL_SPECS) {
    const inputObject = z.object(spec.input);
    const jsonSchema = zodToJsonSchema(inputObject, {
      target: 'openApi3',
      $refStrategy: 'none',
    });

    paths[`/actions/${spec.name}`] = {
      post: {
        operationId: spec.name,
        summary: spec.summary,
        description: spec.description,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: jsonSchema,
            },
          },
        },
        responses: {
          '200': {
            description: 'Tool invocation succeeded.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    actionId: { type: 'string' },
                    result: {
                      type: 'object',
                      description:
                        'MCP tool result envelope with content[] and structuredContent.',
                      additionalProperties: true,
                    },
                  },
                  required: ['actionId', 'result'],
                },
              },
            },
          },
          '400': {
            description: 'Invalid input.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string' } },
                  required: ['error'],
                },
              },
            },
          },
          '401': {
            description: 'Missing or invalid bearer token.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string' } },
                  required: ['error'],
                },
              },
            },
          },
        },
      },
    };
  }

  const doc: Record<string, unknown> = {
    openapi: '3.1.0',
    info: {
      title: `${SERVER_NAME} Actions`,
      version: SERVER_VERSION,
      description:
        "REST mirror of the Intercontinental Zoe MCP tools, suitable for use as a ChatGPT Custom GPT Action. Every tool is exposed as a POST under /actions/:toolName. Responses wrap the MCP tool result in {actionId, result}. The server's canonical data is the only source of truth — never invent destinations, services, prices, or URLs.",
    },
    servers: [{ url: baseUrl }],
    paths,
  };

  if (bearerRequired) {
    doc.components = {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
    };
    doc.security = [{ bearerAuth: [] }];
  }

  return doc;
}
