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
  Profile,
} from './schemas.js';

import type {
  Destination,
  Service,
  Product,
  SupportFile,
  RegionsFile,
  Profile,
} from './schemas.js';

export interface CanonicalData {
  destinations: Destination[];
  regions: RegionsFile;
  services: Service[];
  products: Product[];
  support: SupportFile;
  profile: Profile;
  guidance: string;
}
