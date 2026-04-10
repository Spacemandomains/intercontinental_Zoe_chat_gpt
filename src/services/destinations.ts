import type { Destination, RegionsFile } from '../data/schemas.js';

export interface DestinationFilter {
  region?: string;
  country?: string;
  continent?: string;
}

export function filterDestinations(
  destinations: Destination[],
  filter: DestinationFilter,
): Destination[] {
  return destinations.filter((d) => {
    if (filter.region && d.region.toLowerCase() !== filter.region.toLowerCase()) return false;
    if (filter.country && d.country.toLowerCase() !== filter.country.toLowerCase()) return false;
    if (filter.continent && d.continent.toLowerCase() !== filter.continent.toLowerCase()) return false;
    return true;
  });
}

export function findDestination(
  destinations: Destination[],
  idOrName: string,
): Destination | undefined {
  const q = idOrName.trim().toLowerCase();
  return destinations.find(
    (d) =>
      d.id.toLowerCase() === q ||
      d.name.toLowerCase() === q ||
      d.country.toLowerCase() === q,
  );
}

export function resolveRegion(
  regions: RegionsFile,
  query: string,
): string | undefined {
  const q = query.trim().toLowerCase();
  for (const regionName of Object.keys(regions)) {
    if (regionName.toLowerCase() === q) return regionName;
  }
  return undefined;
}
