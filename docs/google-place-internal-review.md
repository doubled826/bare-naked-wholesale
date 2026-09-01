# Google Autofill For Public Locator Info

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

The caller must be logged in as an admin. The endpoint returns suggested public locator fields, and the admin saves the location after reviewing them.
