import { query } from "./db";
import { SearchInput, searchQuery } from "./search";
export type Listing = {
  id: string;
  title: string;
  body: string;
  kind: "rent" | "sale" | null;
  city: string | null;
  neighborhood: string | null;
  price: string | null;
  rooms: string | null;
  area: string | null;
  published_at: string;
  status: string;
  image_id: string | null;
  amenities: Record<string, boolean>;
  overrides: Record<string, unknown>;
};
export async function getListings(input: SearchInput) {
  const { where, values, order } = searchQuery(input);
  const [count] = await query<{ count: string }>(
    `SELECT count(*) FROM listings l WHERE ${where}`,
    values,
  );
  const items = await query<Listing>(
    `SELECT l.*, (SELECT id FROM images WHERE listing_id=l.id ORDER BY position LIMIT 1) image_id FROM listings l WHERE ${where} ORDER BY ${order},l.id LIMIT 18 OFFSET $${values.length + 1}`,
    [...values, (input.page - 1) * 18],
  );
  return {
    items,
    total: Number(count.count),
    page: input.page,
    pages: Math.ceil(Number(count.count) / 18),
  };
}
export const price = (value: string | null) =>
  value === null
    ? "מחיר לא צוין"
    : new Intl.NumberFormat("he-IL").format(Number(value)) + " ₪";
