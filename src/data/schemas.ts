import { z } from 'zod';

// ---------- Profile ----------

export const profileSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
  pronouns: z.string().min(1),
  gender: z.string().min(1),
  tagline: z.string().min(1),
  bio: z.string().min(1),
  channel: z.object({
    platform: z.string().min(1),
    handle: z.string().min(1),
    url: z.string().url(),
  }),
});
export type Profile = z.infer<typeof profileSchema>;

export const profileFileSchema = profileSchema;

// ---------- Shared ----------

export const moneySchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().length(3),
});
export type Money = z.infer<typeof moneySchema>;

// ---------- Destinations ----------

export const destinationSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'id must be a lowercase slug'),
  name: z.string().min(1),
  country: z.string().min(1),
  region: z.string().min(1),
  continent: z.string().min(1),
  coordinates: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  summary: z.string().min(1),
  highlights: z.array(z.string()).default([]),
  bestTimeToVisit: z.string().optional(),
  playlistId: z.string().min(1),
  videoIds: z.array(z.string()).optional(),
  guideProductId: z.string().optional(),
  rentalProductIds: z.array(z.string()).default([]),
  tips: z.array(z.string()).default([]),
});
export type Destination = z.infer<typeof destinationSchema>;

export const destinationsFileSchema = z.array(destinationSchema);

// ---------- Regions ----------

export const regionsFileSchema = z.record(z.string(), z.array(z.string()));
export type RegionsFile = z.infer<typeof regionsFileSchema>;

// ---------- Services ----------

export const serviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  price: moneySchema,
  duration: z.string().optional(),
  whatsIncluded: z.array(z.string()).min(1),
  deliverables: z.array(z.string()).default([]),
  paypalPaymentLink: z.string().url(),
  crispChatUrl: z.string().url(),
  nextStepCta: z.string().min(1),
});
export type Service = z.infer<typeof serviceSchema>;

export const servicesFileSchema = z.array(serviceSchema);

// ---------- Products ----------

export const productTypeSchema = z.enum(['guide', 'rental', 'merchandise']);
export type ProductType = z.infer<typeof productTypeSchema>;

export const productPlatformSchema = z.enum([
  'shopify',
  'airbnb',
  'vrbo',
  'bookingcom',
  'other',
]);
export type ProductPlatform = z.infer<typeof productPlatformSchema>;

export const productSchema = z.object({
  id: z.string().min(1),
  type: productTypeSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  price: moneySchema.optional(),
  url: z.string().url(),
  platform: productPlatformSchema,
  destinationIds: z.array(z.string()).default([]),
  imageUrl: z.string().url().optional(),
});
export type Product = z.infer<typeof productSchema>;

export const productsFileSchema = z.array(productSchema);

// ---------- Support options (donations / contributions) ----------

export const supportOptionTypeSchema = z.enum([
  'donation',
  'patreon',
  'merch',
  'affiliate',
]);

export const supportOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  url: z.string().url(),
  type: supportOptionTypeSchema,
});
export type SupportOption = z.infer<typeof supportOptionSchema>;

export const supportFileSchema = z.object({
  options: z.array(supportOptionSchema),
});
export type SupportFile = z.infer<typeof supportFileSchema>;
