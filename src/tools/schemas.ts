import { z } from 'zod';

// ---------- Shared primitives ----------

export const videoIdSchema = z
  .string()
  .min(5)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/, 'invalid YouTube video id');

export const languageCodeSchema = z
  .string()
  .min(2)
  .max(10)
  .regex(/^[a-zA-Z-]+$/, 'invalid BCP-47 language code');

export const isoDateSchema = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), 'must be an ISO 8601 date');

// ---------- Shared response wrapper pieces ----------

export const nextStepSchema = z.object({
  label: z.string(),
  description: z.string().optional(),
  tool: z.string().optional(),
  args: z.record(z.unknown()).optional(),
  url: z.string().url().optional(),
});

export const toolResponseEnvelope = z.object({
  ok: z.boolean(),
  notFound: z.boolean().optional(),
  nextSteps: z.array(nextStepSchema).default([]),
});

// ---------- Input schemas for each MCP tool ----------

export const listVideosInput = {
  destinationId: z.string().optional(),
  limit: z.number().int().min(1).max(500).default(50),
  offset: z.number().int().min(0).default(0),
  sort: z.enum(['newest', 'oldest', 'longest', 'shortest']).default('newest'),
} as const;

export const getVideoDetailsInput = {
  videoId: videoIdSchema,
} as const;

export const getVideoTranscriptInput = {
  videoId: videoIdSchema,
  language: languageCodeSchema.optional(),
} as const;

export const searchVideosInput = {
  query: z.string().min(1),
  destinationId: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10),
  publishedAfter: isoDateSchema.optional(),
  publishedBefore: isoDateSchema.optional(),
} as const;

export const listDestinationsInput = {
  region: z.string().optional(),
  country: z.string().optional(),
  continent: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
} as const;

export const getDestinationOverviewInput = {
  destinationIdOrName: z.string().min(1),
  maxVideos: z.number().int().min(1).max(20).default(5),
} as const;

export const listServicesInput = {} as const;

export const getServiceDetailsInput = {
  serviceId: z.string().min(1),
} as const;

export const listProductsInput = {
  type: z.enum(['guide', 'rental', 'merchandise']).optional(),
  destination: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
} as const;

export const listSupportOptionsInput = {} as const;

export const startLeadInput = {
  leadType: z.enum([
    'consultation',
    'guide',
    'rental',
    'merchandise',
    'donation',
    'general',
  ]),
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(1),
  destinationId: z.string().optional(),
  serviceId: z.string().optional(),
  productId: z.string().optional(),
} as const;
