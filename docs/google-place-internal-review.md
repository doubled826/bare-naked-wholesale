# Internal Google Business Review

Retailer locations can be compared against Google Business listings inside the admin portal. This is an internal review aid only.

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
