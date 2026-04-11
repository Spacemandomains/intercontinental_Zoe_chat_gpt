# Editing the canonical data

Everything the LLM says about Zoe's destinations, services, products, and support
options comes from the JSON files under `data/`. Nothing else. If a fact is wrong
or missing, you fix it here — not in the code, not in the prompt.

## The files

| File | Contents |
|---|---|
| `data/destinations.json` | Array of destinations. One entry per country Zoe has visited. Must include `playlistId` pointing at his per-country YouTube playlist. |
| `data/profile.json` | Zoe's canonical profile: name, pronouns (he/him), gender, bio, and YouTube channel URL. Powers the `get_profile` tool and the `channelUrl` echoed on every video-tool response. |
| `data/regions.json` | Map of region name → array of country names. Must contain every `region` value referenced from `destinations.json`. |
| `data/services.json` | Zoe's services (consultation, itinerary, group trip, concierge). Each has price, PayPal link, Crisp chat link, and next-step CTA. |
| `data/products.json` | Guides, rentals, merchandise. Each has a real URL (Shopify, Airbnb, etc.) and platform. |
| `data/support.json` | Donation / Patreon / merch / affiliate options. |
| `data/guidance.md` | System prompt exposed at `guidance://system`. Anti-hallucination + sales-funnel ground rules. |

All files are validated against zod schemas in `src/data/schemas.ts` at startup.
**The server refuses to start on schema errors** — you get a concise list of
issues pointing at the offending file and JSON path.

## Cross-reference checks

`src/data/loader.ts` also runs the following cross-reference checks (all fatal):

1. Every `destination.region` must be a key in `regions.json`.
2. Every `destination.guideProductId` must exist in `products.json`.
3. Every id in `destination.rentalProductIds` must exist in `products.json`.

Add things in the right order to keep validation happy: new products **before**
the destinations that reference them.

## Extracting a YouTube playlist ID

A playlist URL like:

```
https://www.youtube.com/playlist?list=PLxxxxxxxxxxxxxxxxxxxxxxxxx
```

The part after `list=` is the playlist ID. Paste it into the destination's
`playlistId` field. Do **not** paste the full URL.

## Editing prices

Prices are strictly typed:

```json
"price": { "amount": 149, "currency": "USD" }
```

- `amount` is a non-negative number.
- `currency` is a 3-letter ISO code (`USD`, `EUR`, `GBP`, …).
- No ranges. No "starts at". No "around".

If Zoe offers a tier structure, create one service entry per tier rather than
embedding ranges.

## Adding a new destination (worked example)

1. If the region is new, add it to `regions.json`:
   ```json
   {
     "Southeast Asia": ["Thailand", "Vietnam", "Philippines", "Indonesia"]
   }
   ```
2. Add any rental / guide products to `products.json` first (so you can reference
   their ids).
3. Add the destination entry to `destinations.json`:
   ```json
   {
     "id": "indonesia",
     "name": "Indonesia",
     "country": "Indonesia",
     "region": "Southeast Asia",
     "continent": "Asia",
     "summary": "Zoe has lived and shot multiple video series across Bali and Java.",
     "highlights": ["Ubud rice terraces", "Mount Bromo sunrise", "Gili island dive sites"],
     "bestTimeToVisit": "May to September",
     "playlistId": "PLxxxxxxxxxxxxxxxxxxxxxxxxx",
     "guideProductId": "guide-indonesia",
     "rentalProductIds": ["rental-ubud-villa-01"],
     "tips": ["Carry small rupiah for warungs.", "Book ferries between islands in advance."]
   }
   ```
4. Either restart the server or send it a `SIGHUP`:
   ```bash
   kill -HUP $(pgrep -f dist/index.js)
   ```
   The server will reload all JSON and rebuild the YouTube catalog without
   dropping connections.

## Hot reload (SIGHUP)

`src/index.ts` registers a `SIGHUP` handler that calls `context.reloadData()`.
This re-reads every file under `data/`, re-validates it, and rebuilds the
YouTube catalog. If reload fails, the error is logged and the previously loaded
data stays in place — so a typo in a JSON file never takes the server down.

## Common validation errors

| Message | Cause |
|---|---|
| `id must be a lowercase slug` | Ids must be `lowercase-kebab-case`. |
| `must be an ISO 8601 date` | Use `YYYY-MM-DD` or a full ISO timestamp. |
| `Destinations reference unknown regions` | Add the region to `regions.json`. |
| `Destinations reference unknown products` | Add the product to `products.json` before referencing it. |
| `Required` | A non-optional field is missing — check the schema in `src/data/schemas.ts`. |
