export type GeocodeResult = {
  latitude: number;
  longitude: number;
  formattedAddress?: string | null;
};

export class GeocodingConfigurationError extends Error {
  constructor(message = 'Missing geocoding API key.') {
    super(message);
    this.name = 'GeocodingConfigurationError';
  }
}

export class GeocodingLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeocodingLookupError';
  }
}

const getGeocodingApiKey = () => (
  process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''
);

export const isGeocodingConfigured = () => Boolean(getGeocodingApiKey());

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const trimmedAddress = address.trim();
  if (!trimmedAddress) {
    throw new GeocodingLookupError('Address is required.');
  }

  const apiKey = getGeocodingApiKey();
  if (!apiKey) {
    throw new GeocodingConfigurationError();
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', trimmedAddress);
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new GeocodingLookupError(`Geocoding request failed with status ${response.status}.`);
  }

  const payload = await response.json();

  if (payload.status !== 'OK' || !payload.results?.[0]?.geometry?.location) {
    const reason = payload.error_message || payload.status || 'No geocoding result found.';
    throw new GeocodingLookupError(reason);
  }

  const result = payload.results[0];
  const latitude = Number(result.geometry.location.lat);
  const longitude = Number(result.geometry.location.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new GeocodingLookupError('Geocoding result did not include valid coordinates.');
  }

  return {
    latitude,
    longitude,
    formattedAddress: result.formatted_address || null,
  };
}
