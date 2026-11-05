import { z } from "zod";
import { publicListing } from "./visibility";
const optionalNumber = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().min(0).max(max).optional(),
  );
export const searchSchema = z.object({
  q: z.string().max(100).optional(),
  city: z.string().max(80).optional(),
  neighborhood: z.string().max(80).optional(),
  kind: z.enum(["rent", "sale", ""]).optional(),
  min: optionalNumber(1000000000),
  max: optionalNumber(1000000000),
  rooms: optionalNumber(30),
  days: optionalNumber(365),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
  ids: z.string().max(4000).optional(),
}).refine(value=>value.min===undefined||value.max===undefined||value.min<=value.max,{message:'Minimum price exceeds maximum',path:['min']});
export type SearchInput = z.infer<typeof searchSchema>;
export function searchQuery(input: SearchInput) {
  const values: unknown[] = [];
  const clauses = [
    publicListing,
  ];
  const add = (sql: string, value: unknown) => {
    values.push(value);
    clauses.push(sql.replace("?", `$${values.length}`));
  };
  if (input.q)
    add(
      "(l.title || ' ' || l.body) ILIKE ?",
      "%" + input.q.replace(/[\\%_]/g, "\\$&") + "%",
    );
  if (input.city) add("l.city=?", input.city);
  if (input.neighborhood)
    add(
      "l.neighborhood ILIKE ?",
      "%" + input.neighborhood.replace(/[\\%_]/g, "\\$&") + "%",
    );
  if (input.kind) add("l.kind=?", input.kind);
  if (input.min !== undefined) add("l.price>=?", input.min);
  if (input.max !== undefined) add("l.price<=?", input.max);
  if (input.rooms !== undefined) add("l.rooms>=?", input.rooms);
  if (input.days !== undefined)
    add("l.published_at>=now()-(? * interval '1 day')", input.days);
  if (input.ids !== undefined) {
    const ids = input.ids
      .split(",")
      .filter((v) => z.uuid().safeParse(v).success)
      .slice(0, 100);
    add("l.id=ANY(?::uuid[])", ids);
  }
  const order = {
    newest: "l.published_at DESC",
    price_asc: "l.price ASC NULLS LAST",
    price_desc: "l.price DESC NULLS LAST",
  }[input.sort];
  return { where: clauses.join(" AND "), values, order };
}
