// Rooms and floor area are one category, not two independent requirements.
// Keep this gate on every public entry point, including direct links and media.
export const publicListing = `l.status='published' AND l.expires_at>now()
  AND l.published_at>=now()-interval '3 days' AND l.published_at<=now()
  AND (COALESCE((l.kind IN ('rent','sale'))::int,0)
    + (l.price IS NOT NULL AND l.price>0)::int
    + ((l.rooms IS NOT NULL AND l.rooms>0) OR (l.area IS NOT NULL AND l.area>0))::int
    + (NULLIF(trim(l.city),'') IS NOT NULL)::int)>=3
  AND EXISTS(SELECT 1 FROM posts p JOIN sources s ON s.id=p.source_id
    WHERE p.listing_id=l.id AND s.approved AND s.publication_confirmed)`;
