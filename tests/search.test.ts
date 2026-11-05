import { test } from "node:test";
import assert from "node:assert/strict";
import { searchSchema, searchQuery } from "../src/lib/search";
test("rejects unsafe pagination and invalid numeric filters", () => {
  for (const input of [
    { page: 0 },
    { page: 1.5 },
    { max: -1 },
    { rooms: 99 },
    { sort: "DROP TABLE" },
  ])
    assert.equal(searchSchema.safeParse(input).success, false);
});
test("search values remain bound parameters and empty values stay unset", () => {
  const input = searchSchema.parse({
    city: "x' OR 1=1 --",
    min: "",
    q: "100%",
  });
  const result = searchQuery(input);
  assert.ok(!result.where.includes(input.city!));
  assert.ok(result.values.includes(input.city));
  assert.equal(input.min, undefined);
  assert.ok(result.values.includes("%100\\%%"));
  assert.ok(result.where.includes("s.publication_confirmed"));
});
test("malformed favorite IDs cannot expose all listings", () => {
  const result = searchQuery(searchSchema.parse({ ids: "bad" }));
  assert.deepEqual(result.values, [[]]);
  assert.ok(result.where.includes("ANY"));
});
