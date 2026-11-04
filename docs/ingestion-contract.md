# Future ingestion contract (not an implemented endpoint)

Milestone 1 has no ingestion API or collector. This is the proposed v1 adapter boundary for milestone 2/3. `owner_id` is absent: derive it from the authenticated Miftan user.

```json
{
  "version": 1,
  "source_id": "UUID of a source owned by the authenticated user",
  "provider": "facebook",
  "external_post_id": "stable provider identifier, never a DOM index",
  "canonical_url": "https://www.facebook.com/...",
  "published_at": "2026-11-04T08:00:00Z",
  "collected_at": "2026-11-04T08:01:00Z",
  "body": "Permitted original Hebrew text",
  "comments": [{ "external_comment_id": "stable-id", "text": "Permitted relevant comment", "published_at": null }],
  "links": ["https://example.com/listing"],
  "images": [{ "local_reference": "opaque local image identifier", "display_order": 0 }]
}
```

- Send only authorized data; never passwords, cookies, browser storage, tokens, profile dumps, author profiles or full HTML. Facebook sessions stay in a dedicated local browser profile outside this repository.
- Validate source ownership, matching provider, stable ID, actual publication timestamp and permission scope. Reject unresolved publication dates instead of substituting collection time. Discard posts older than six calendar months. Use UTC timestamps and Asia/Jerusalem for display.
- Upsert on `(owner_id, provider, external_post_id)`. A repost with a new provider ID remains a separate post until explicit cross-post matching ships.
- Images use a separate authenticated binary upload, not arbitrary URLs fetched by the server. Validate actual content, MIME type and size. Generate owner-prefixed names; insert metadata before upload. Never send signed Facebook URLs or credentials to server fetchers.
- Parsed fields: `listing_type: rental | sale | unknown`, nullable `city`, `neighborhood`, `price_ils`, `rooms`, and `details` JSON. Unknown values are null, never zero. One listing per post in the MVP.
- Collection remains database-disabled until permission limits, cleanup and companion authentication/leases ship. Authorization status alone cannot enable it.

## Retention and storage lifecycle

RLS hides posts before `now() - interval '6 months'` and propagates the rule through listings, image metadata and Storage reads. The exact cutoff is included. Missing dates cannot be inserted. Expired data remains physically stored until the cleanup milestone; do not use this foundation for live collection yet.

Before ingestion, implement retryable privileged cleanup: delete objects through the Storage API, then database records; handle orphan objects, account deletion and failed uploads. SQL cascades do not delete Storage bytes. Prefer authenticated image retrieval; any future signed URL TTL must not exceed remaining retention. Already downloaded bytes cannot be revoked.

## Companion direction

The manually launched Windows Python companion uses outbound authenticated requests. A short-lived web heartbeat gates collection, with one collector lease per user and serialized work. A 30-second eligibility check does not mean fetching every source every 30 seconds. Permission limits and backoff take precedence. Session expiry or browser challenges stop collection for local user intervention.
