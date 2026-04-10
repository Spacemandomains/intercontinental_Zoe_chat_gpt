export type {
  Destination,
  Service,
  Product,
  ProductType,
  ProductPlatform,
  SupportOption,
  SupportFile,
  RegionsFile,
  Money,
} from './schemas.js';

import type {
  Destination,
  Service,
  Product,
  SupportFile,
  RegionsFile,
} from './schemas.js';

export interface CanonicalData {
  destinations: Destination[];
  regions: RegionsFile;
  services: Service[];
  products: Product[];
  support: SupportFile;
  guidance: string;
}
