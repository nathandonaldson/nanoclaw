# Package Tracking

Triggered by "packages", "where is it", "what's coming", or similar.

## Flow

1. Read `/workspace/global/knowledge/packages.md` for current state.
2. Scan recent emails for new shipping notifications or tracking updates not yet captured (search via `mcp__gmail__search_messages` with query `newer_than:7d (shipping OR tracking OR delivered OR dispatch OR order confirmed)`).
3. For packages with tracking numbers, check status using the tracking methods below.
4. Update `/workspace/global/knowledge/packages.md` with any changes.
5. Reply with a summary of active packages.

## Tracking Methods

*Japan Post / EMS* (tracking format: `[A-Z]{2}\d{9}JP`):
```bash
curl -s "https://trackings.post.japanpost.jp/services/srv/search/?requestNo1=TRACKING&search.x=1&locale=en"
```
Parse dates and statuses from the HTML.

*USPS International* (tracking format: `[A-Z]{2}\d{9}US`):
```bash
curl -sL "https://www.stamps.com/tracking-details/?t=TRACKING"
```

*NZ Post / CourierPost*: JS-rendered, can't curl. Use WebFetch or note "check manually at nzpost.co.nz".

*No tracking number*: Status is based on last email update. Scan for follow-up emails.

## Auto-Capture from Emails

When scanning emails, look for:
- Order confirmations: extract order number, retailer, items
- Shipping notifications: extract tracking number, carrier
- Delivery confirmations: move package to Delivered section

## Output Format

```
📦 N packages active

1. Description (from Retailer)
   Status — last updated DATE

2. Description (from Retailer)
   Tracking: CODE — Status
```

## State Management

- Active packages stay until Nathan confirms delivery or a delivery email arrives
- Move delivered packages to the Delivered section with date
- Prune delivered packages older than 30 days
- When Nathan says "it arrived" or similar, move it to Delivered
