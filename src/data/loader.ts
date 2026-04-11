import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import {
  destinationsFileSchema,
  regionsFileSchema,
  servicesFileSchema,
  productsFileSchema,
  supportFileSchema,
  profileFileSchema,
} from './schemas.js';
import type { CanonicalData } from './types.js';

async function readJson<S extends z.ZodTypeAny>(path: string, schema: S): Promise<z.infer<S>> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read data file ${path}: ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${path}: ${(err as Error).message}`);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Schema validation failed for ${path}:\n${issues}`);
  }
  return result.data;
}

async function readText(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read text file ${path}: ${(err as Error).message}`);
  }
}

export async function loadCanonicalData(dataDir: string): Promise<CanonicalData> {
  const dir = resolve(dataDir);

  const [destinations, regions, services, products, support, profile, guidance] =
    await Promise.all([
      readJson(join(dir, 'destinations.json'), destinationsFileSchema),
      readJson(join(dir, 'regions.json'), regionsFileSchema),
      readJson(join(dir, 'services.json'), servicesFileSchema),
      readJson(join(dir, 'products.json'), productsFileSchema),
      readJson(join(dir, 'support.json'), supportFileSchema),
      readJson(join(dir, 'profile.json'), profileFileSchema),
      readText(join(dir, 'guidance.md')),
    ]);

  // Cross-reference validation: every destination.region must exist in regions.json.
  const validRegions = new Set(Object.keys(regions));
  const unknownRegions = destinations
    .filter((d) => !validRegions.has(d.region))
    .map((d) => `${d.id} → ${d.region}`);
  if (unknownRegions.length > 0) {
    throw new Error(
      `Destinations reference unknown regions (add them to regions.json):\n  - ${unknownRegions.join('\n  - ')}`,
    );
  }

  // Cross-reference: destination.guideProductId / rentalProductIds must exist in products.json.
  const productIds = new Set(products.map((p) => p.id));
  const missingRefs: string[] = [];
  for (const d of destinations) {
    if (d.guideProductId && !productIds.has(d.guideProductId)) {
      missingRefs.push(`${d.id}.guideProductId → ${d.guideProductId}`);
    }
    for (const rid of d.rentalProductIds) {
      if (!productIds.has(rid)) {
        missingRefs.push(`${d.id}.rentalProductIds → ${rid}`);
      }
    }
  }
  if (missingRefs.length > 0) {
    throw new Error(
      `Destinations reference unknown products (add them to products.json):\n  - ${missingRefs.join('\n  - ')}`,
    );
  }

  return { destinations, regions, services, products, support, profile, guidance };
}
