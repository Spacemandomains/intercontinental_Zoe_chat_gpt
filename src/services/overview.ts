import type { CanonicalData, Destination, Product, Service } from '../data/types.js';
import type { Catalog } from '../youtube/catalog.js';
import type { CatalogVideo } from '../youtube/types.js';
import { findDestination } from './destinations.js';

export interface DestinationOverview {
  destination: Destination;
  videos: CatalogVideo[];
  guide?: Product;
  rentals: Product[];
  recommendedServices: Service[];
  supportingProducts: Product[];
  tips: string[];
}

export function buildDestinationOverview(
  data: CanonicalData,
  catalog: Catalog,
  idOrName: string,
  options: { maxVideos?: number } = {},
): DestinationOverview | null {
  const destination = findDestination(data.destinations, idOrName);
  if (!destination) return null;

  const allVideos = catalog.byDestination.get(destination.id) ?? [];
  const videos = allVideos
    .slice()
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, options.maxVideos ?? 5);

  const guide = destination.guideProductId
    ? data.products.find((p) => p.id === destination.guideProductId)
    : undefined;

  const rentals = data.products.filter(
    (p) =>
      p.type === 'rental' &&
      (destination.rentalProductIds.includes(p.id) ||
        p.destinationIds.includes(destination.id)),
  );

  // Recommend consultation + custom-itinerary by default for trip planning; if they don't exist, return all services.
  const preferredIds = ['consultation', 'custom-itinerary'];
  const recommendedServices = data.services.filter((s) => preferredIds.includes(s.id));
  const services =
    recommendedServices.length > 0 ? recommendedServices : data.services.slice(0, 2);

  const supportingProducts = data.products.filter(
    (p) => p.type === 'merchandise' || (p.type === 'guide' && p.id !== guide?.id),
  );

  return {
    destination,
    videos,
    guide,
    rentals,
    recommendedServices: services,
    supportingProducts,
    tips: destination.tips,
  };
}
