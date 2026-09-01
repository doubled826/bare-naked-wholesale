# Internal Google Business Review

Retailer locations can be autofilled from Google Business listings inside the admin portal. This is an admin-approved review aid: Google can populate the public locator fields, but the admin still saves the final values.

The store locator API now uses these public-facing fields first:

- `public_display_name`
- `public_address`
- `public_phone`
- `website_url`
- `latitude`
- `longitude`

If a public address or phone is blank, the API falls back to the retailer location's account address and phone.

## Admin Workflow

1. Open a retailer detail page.
2. Edit the store location.
3. Paste a Google Maps or Google Business listing link into `Google Maps Listing URL`.
4. Click `Autofill`.
5. Review the public store name, public address, public phone, website, and coordinates.
6. Save the location.

The retailer's wholesale account address and phone are not changed by this workflow.

## Endpoint

```http
POST /api/admin/retailer-locations/:id/google-place
```

The caller must be logged in as an admin.

The endpoint searches Google Places using the location display name and business address, then returns the strongest match:

```json
{
  "success": true,
  "match": {
    "placeId": "places/...",
    "displayName": "Neighborhood Pet Shop",
    "formattedAddress": "123 Main St, Detroit, MI 48201, USA",
    "nationalPhoneNumber": "(555) 000-0000",
    "internationalPhoneNumber": "+1 555-000-0000",
    "websiteUri": "https://shop.example.com",
    "googleMapsUri": "https://maps.google.com/...",
    "businessStatus": "OPERATIONAL",
    "latitude": 42.3314,
    "longitude": -83.0458,
    "confidence": 0.87
  }
}
```

The portal stores `google_place_id`, match confidence, match timestamp, and match errors. It does not overwrite public store locator address or phone fields automatically.

The manual autofill endpoint accepts a pasted Google Maps link:

```http
POST /api/admin/retailer-locations/:id/google-place/autofill
Content-Type: application/json
```

```json
{
  "googleMapsUrl": "https://maps.app.goo.gl/example"
}
```
