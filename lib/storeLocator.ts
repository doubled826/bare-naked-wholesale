import type { PublicStoreLocatorLocation } from '@/types';

export type StoreLocatorRetailerRow = {
  company_name?: string | null;
  logo_url?: string | null;
};

export type StoreLocatorLocationRow = {
  id: string;
  retailer_id: string;
  location_name: string;
  business_address: string;
  phone?: string | null;
  public_display_name?: string | null;
  website_url?: string | null;
  instagram_url?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  public_hours?: string | null;
  public_notes?: string | null;
  locator_updated_at?: string | null;
  locator_verified_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  retailer?: StoreLocatorRetailerRow | StoreLocatorRetailerRow[] | null;
};

const toNullableNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const cleanString = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed || null;
};

const getRetailer = (retailer: StoreLocatorLocationRow['retailer']) => (
  Array.isArray(retailer) ? retailer[0] : retailer
);

export const toPublicStoreLocatorLocation = (
  location: StoreLocatorLocationRow,
): PublicStoreLocatorLocation => {
  const retailer = getRetailer(location.retailer);
  const name = cleanString(location.public_display_name)
    || cleanString(location.location_name)
    || cleanString(retailer?.company_name)
    || 'Bare Naked Pet Co. Retailer';

  return {
    id: location.id,
    retailer_id: location.retailer_id,
    name,
    address: location.business_address,
    phone: cleanString(location.phone),
    website_url: cleanString(location.website_url),
    instagram_url: cleanString(location.instagram_url),
    latitude: toNullableNumber(location.latitude),
    longitude: toNullableNumber(location.longitude),
    hours: cleanString(location.public_hours),
    notes: cleanString(location.public_notes),
    logo_url: cleanString(retailer?.logo_url),
    last_updated_at: location.locator_updated_at || location.updated_at || location.created_at || null,
    verified_at: location.locator_verified_at || null,
  };
};
