export type GooglePlaceMatch = {
  placeId: string;
  displayName: string | null;
  formattedAddress: string | null;
  nationalPhoneNumber: string | null;
  internationalPhoneNumber: string | null;
  websiteUri: string | null;
  googleMapsUri: string | null;
  businessStatus: string | null;
  latitude: number | null;
  longitude: number | null;
  confidence: number;
};

export class GooglePlacesConfigurationError extends Error {
  constructor(message = 'Missing Google Places API key.') {
    super(message);
    this.name = 'GooglePlacesConfigurationError';
  }
}

export class GooglePlacesLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GooglePlacesLookupError';
  }
}

const getGooglePlacesApiKey = () => (
  process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''
);

export const isGooglePlacesConfigured = () => Boolean(getGooglePlacesApiKey());

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const tokenOverlap = (a: string, b: string) => {
  const aTokens = new Set(normalize(a).split(' ').filter(Boolean));
  const bTokens = new Set(normalize(b).split(' ').filter(Boolean));
  if (!aTokens.size || !bTokens.size) return 0;

  let matches = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) matches += 1;
  });

  return matches / Math.max(aTokens.size, bTokens.size);
};

const includesStreetNumber = (address: string, googleAddress: string | null) => {
  const streetNumber = address.match(/\b\d{1,6}\b/)?.[0];
  if (!streetNumber || !googleAddress) return false;
  return normalize(googleAddress).split(' ').includes(streetNumber);
};

const calculateConfidence = (input: { name: string; address: string }, place: GooglePlaceMatch) => {
  const nameScore = place.displayName ? tokenOverlap(input.name, place.displayName) : 0;
  const addressScore = place.formattedAddress ? tokenOverlap(input.address, place.formattedAddress) : 0;
  const streetNumberBoost = includesStreetNumber(input.address, place.formattedAddress) ? 0.15 : 0;
  const confidence = (nameScore * 0.45) + (addressScore * 0.4) + streetNumberBoost;

  return Math.max(0, Math.min(1, Number(confidence.toFixed(2))));
};

type PlacesApiPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

export async function findGoogleBusinessMatch(input: {
  name: string;
  address: string;
  city?: string | null;
  state?: string | null;
}): Promise<GooglePlaceMatch> {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    throw new GooglePlacesConfigurationError();
  }

  const textQuery = [
    input.name,
    input.address,
    input.city,
    input.state,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (!textQuery) {
    throw new GooglePlacesLookupError('Store name or address is required.');
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.nationalPhoneNumber',
        'places.internationalPhoneNumber',
        'places.websiteUri',
        'places.googleMapsUri',
        'places.businessStatus',
        'places.location',
      ].join(','),
    },
    body: JSON.stringify({
      textQuery,
      maxResultCount: 3,
      languageCode: 'en',
      regionCode: 'US',
    }),
  });

  if (!response.ok) {
    throw new GooglePlacesLookupError(`Google Places request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const places = (payload.places || []) as PlacesApiPlace[];

  if (!places.length) {
    throw new GooglePlacesLookupError('No Google Business listing found.');
  }

  const matches = places
    .filter((place) => place.id)
    .map((place) => {
      const match: GooglePlaceMatch = {
        placeId: place.id || '',
        displayName: place.displayName?.text || null,
        formattedAddress: place.formattedAddress || null,
        nationalPhoneNumber: place.nationalPhoneNumber || null,
        internationalPhoneNumber: place.internationalPhoneNumber || null,
        websiteUri: place.websiteUri || null,
        googleMapsUri: place.googleMapsUri || null,
        businessStatus: place.businessStatus || null,
        latitude: Number.isFinite(place.location?.latitude) ? Number(place.location?.latitude) : null,
        longitude: Number.isFinite(place.location?.longitude) ? Number(place.location?.longitude) : null,
        confidence: 0,
      };

      return {
        ...match,
        confidence: calculateConfidence({ name: input.name, address: input.address }, match),
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  const match = matches[0];
  if (!match) {
    throw new GooglePlacesLookupError('No Google Business listing found.');
  }

  return match;
}
