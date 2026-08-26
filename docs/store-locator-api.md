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

Admins manage public locator fields from each retailer detail page under the location edit form. A location does not appear in the API until an admin enables **Show in store locator**.

Coordinates are optional. A Replit frontend can still show a searchable list without them, but map pins and distance sorting should prefer rows with `latitude` and `longitude`.
