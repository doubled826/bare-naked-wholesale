# Store Locator API

The portal exposes approved public retailer locations for external store locator frontends.

## Endpoint

```http
GET /api/store-locator/locations
```

The endpoint is public, read-only, CORS-enabled, and returns only `retailer_locations` rows where `is_public = true`.

## Response

```json
{
  "locations": [
    {
      "id": "location-id",
      "retailer_id": "retailer-id",
      "name": "Happy Paws Market",
      "address": "123 Main St, Detroit, MI 48201",
      "phone": "(555) 555-5555",
      "website_url": "https://example.com",
      "instagram_url": "https://instagram.com/example",
      "latitude": 42.3314,
      "longitude": -83.0458,
      "hours": "Mon-Fri 10-6, Sat 10-4",
      "notes": "Carries select Bare Naked Pet Co. items.",
      "logo_url": "https://...",
      "last_updated_at": "2026-08-26T18:00:00.000Z",
      "verified_at": "2026-08-26T18:00:00.000Z"
    }
  ],
  "meta": {
    "count": 1,
    "generated_at": "2026-08-26T18:00:00.000Z"
  }
}
```

## Curation

Store locations are public by default so new retailer locations flow into the locator automatically. Admins can remove any location from the public feed from each retailer detail page by editing the location and turning off **Show in store locator**.

Coordinates are optional. A Replit frontend can still show a searchable list without them, but map pins and distance sorting should prefer rows with `latitude` and `longitude`.

## Portal Geocoding

Set `GOOGLE_MAPS_API_KEY` or `GOOGLE_GEOCODING_API_KEY` in Vercel. The key must have access to the Google Geocoding API.

New or updated portal locations call the portal geocoding endpoint after save. Existing public locations can be geocoded in batches by an admin:

```http
POST /api/admin/store-locator/geocode?limit=25
```

The batch endpoint only processes public locations missing coordinates. Increase `limit` up to `100` and repeat until `processed` returns `0`.
