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
  resolvedUrl?: string | null;
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

const GOOGLE_MAPS_HOSTS = new Set([
  'google.com',
  'www.google.com',
  'maps.google.com',
  'maps.app.goo.gl',
  'share.google',
  'goo.gl',
]);

const getHostname = (value: string) => {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
};

export const isGoogleMapsUrl = (value: string) => {
  const hostname = getHostname(value);
  return GOOGLE_MAPS_HOSTS.has(hostname) || hostname.endsWith('.google.com');
};

const ensureUrl = (value: string) => {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export async function resolveGoogleMapsUrl(value: string) {
  const url = ensureUrl(value);
  if (!isGoogleMapsUrl(url)) {
    throw new GooglePlacesLookupError('Paste a Google Maps or Google Business listing link.');
  }

  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': 'Bare Naked Pet Co. Portal',
    },
  });

  return response.url || url;
}

export const extractGoogleMapsQuery = (value: string) => {
  try {
    const url = new URL(value);
    const directQuery = url.searchParams.get('q') || url.searchParams.get('query');
    if (directQuery) return directQuery.trim();

    const placeMatch = url.pathname.match(/\/maps\/place\/([^/]+)/);
    if (placeMatch?.[1]) {
      return decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')).trim();
    }

    const searchMatch = url.pathname.match(/\/maps\/search\/([^/]+)/);
    if (searchMatch?.[1]) {
      return decodeURIComponent(searchMatch[1].replace(/\+/g, ' ')).trim();
    }
  } catch {
    return '';
  }

  return '';
};

const getGoogleErrorMessage = async (response: Response) => {
  const payload = await response.json().catch(() => null);
  const status = payload?.error?.status || payload?.status;
  const message = payload?.error?.message || payload?.error_message || payload?.message;
  const details = [status, message].filter(Boolean).join(': ');

  return details || `Google Places request failed with status ${response.status}.`;
};

export async function findGoogleBusinessMatch(input: {
  name: string;
  address: string;
  city?: string | null;
  state?: string | null;
  googleMapsUrl?: string | null;
}): Promise<GooglePlaceMatch> {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    throw new GooglePlacesConfigurationError();
  }

  const resolvedUrl = input.googleMapsUrl ? await resolveGoogleMapsUrl(input.googleMapsUrl) : '';
  const linkQuery = resolvedUrl ? extractGoogleMapsQuery(resolvedUrl) : '';
  const textQuery = linkQuery || [
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
    throw new GooglePlacesLookupError(await getGoogleErrorMessage(response));
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
        resolvedUrl: resolvedUrl || null,
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
