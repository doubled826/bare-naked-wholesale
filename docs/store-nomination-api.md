# Store Nomination Intake API

Replit can submit customer store recommendations to the wholesale portal with this endpoint:

```http
POST https://wholesale.barenakedpet.com/api/store-nominations
Content-Type: application/json
```

If `STORE_NOMINATION_INTAKE_TOKEN` is configured in Vercel, also send one of these:

```http
Authorization: Bearer YOUR_TOKEN
X-Store-Nomination-Token: YOUR_TOKEN
```

## Payload

```json
{
  "consumerName": "Alex Morgan",
  "consumerEmail": "alex@example.com",
  "consumerPhone": "(555) 000-0000",
  "storeName": "Neighborhood Pet Shop",
  "storeAddress": "123 Main Street",
  "storeCity": "Detroit",
  "storeState": "MI",
  "storePostalCode": "48201",
  "storeUrl": "shop.example.com",
  "note": "They carry lots of natural pet food.",
  "source": "store_locator",
  "landingPageUrl": "https://your-replit-page.replit.app",
  "utmSource": "shopify",
  "utmMedium": "store_locator",
  "utmCampaign": "local_store_nomination"
}
```

Required fields:

- `consumerName`
- `consumerEmail`
- `storeName`
- `storeCity`
- `storeState`

The API also accepts snake_case names, such as `consumer_name`, `store_name`, and `store_postal_code`.

## Success Response

```json
{
  "success": true,
  "nomination": {
    "id": "uuid",
    "status": "new"
  }
}
```

Nominations appear in the admin portal at `/admin/store-nominations`.
