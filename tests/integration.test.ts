import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key || !serviceKey || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) {
  throw new Error('Integration tests require local Supabase URL, publishable key and test-only service role key.');
}
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, options);
const anon = createClient(url, key, options);
const clients: SupabaseClient[] = [];
const owners: string[] = [];
const sources: string[] = [];
const posts: string[] = [];
const listings: string[] = [];
const paths: string[] = [];
const run = randomUUID();
const password = 'Test-only-Password-429!';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDRsAAAAASUVORK5CYII=', 'base64');
function ok(error: unknown) { assert.equal(error, null, JSON.stringify(error)); }

before(async () => {
  for (let i = 0; i < 2; i++) {
    const email = `isolation-${run}-${i}@example.com`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    ok(created.error); owners.push(created.data.user!.id);
    const client = createClient(url, key, options); clients.push(client);
    ok((await client.auth.signInWithPassword({ email, password })).error);
    const source = await client.from('sources').insert({ owner_id: owners[i], kind: 'group', source_url: `https://www.facebook.com/groups/${run}`, display_name: 'מקור בדיקה' }).select().single();
    ok(source.error); sources.push(source.data.id); assert.equal(source.data.enabled, false);
    const post = await client.from('posts').insert({ owner_id: owners[i], source_id: sources[i], provider: 'facebook', external_post_id: run, canonical_url: 'https://www.facebook.com/posts/test', published_at: new Date().toISOString() }).select().single();
    ok(post.error); posts.push(post.data.id);
    const listing = await client.from('listings').insert({ owner_id: owners[i], post_id: posts[i] }).select().single();
    ok(listing.error); listings.push(listing.data.id);
    assert.equal(listing.data.price_ils, null); assert.equal(listing.data.rooms, null); assert.equal(listing.data.city, null); assert.equal(listing.data.listing_type, 'unknown');
    const path = `${owners[i]}/${run}.png`; paths.push(path);
    ok((await client.from('listing_images').insert({ owner_id: owners[i], listing_id: listings[i], storage_path: path })).error);
    ok((await client.storage.from('listing-images').upload(path, png, { contentType: 'image/png' })).error);
  }
});

after(async () => {
  if (paths.length) await admin.storage.from('listing-images').remove(paths);
  for (const id of owners) await admin.auth.admin.deleteUser(id);
});

test('anonymous access cannot read private tables or images', async () => {
  for (const table of ['sources', 'posts', 'listings', 'listing_images']) {
    const result = await anon.from(table).select('*');
    assert.ok(result.error || result.data?.length === 0);
  }
  assert.ok((await anon.storage.from('listing-images').download(paths[0])).error);
});

test('users cannot read, update, delete or forge another owner in any table', async () => {
  const image = await admin.from('listing_images').select('id').eq('storage_path', paths[1]).single(); ok(image.error);
  const targets = [sources[1], posts[1], listings[1], image.data!.id];
  const tables = ['sources', 'posts', 'listings', 'listing_images'];
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i]; const id = targets[i];
    const read = await clients[0].from(table).select('*').eq('id', id); ok(read.error); assert.deepEqual(read.data, []);
    const update = await clients[0].from(table).update({ owner_id: owners[0] }).eq('id', id).select(); ok(update.error); assert.deepEqual(update.data, []);
    const deletion = await clients[0].from(table).delete().eq('id', id).select(); ok(deletion.error); assert.deepEqual(deletion.data, []);
    const original = await admin.from(table).select('*').eq('id', id).single(); ok(original.error);
    const forged = { ...original.data, id: randomUUID() };
    if (table === 'sources') forged.source_url += '/forged';
    if (table === 'posts') forged.external_post_id += '-forged';
    if (table === 'listing_images') forged.storage_path += '.forged';
    assert.ok((await clients[0].from(table).insert(forged)).error);
  }
  assert.ok((await clients[0].from('sources').update({ owner_id: owners[1] }).eq('id', sources[0])).error);
});

test('ownership constraints reject cross-user relationships', async () => {
  assert.ok((await clients[0].from('posts').insert({ owner_id: owners[0], source_id: sources[1], provider: 'facebook', external_post_id: `${run}-cross`, canonical_url: 'https://example.com/post', published_at: new Date().toISOString() })).error);
  assert.ok((await clients[0].from('listings').insert({ owner_id: owners[0], post_id: posts[1] })).error);
  assert.ok((await clients[0].from('listing_images').insert({ owner_id: owners[0], listing_id: listings[1], storage_path: `${owners[0]}/cross.png` })).error);
});

test('deduplication is per owner and listing uniqueness is per post', async () => {
  // Setup successfully inserted the same provider ID for two different users.
  const duplicate = await clients[0].from('posts').insert({ owner_id: owners[0], source_id: sources[0], provider: 'facebook', external_post_id: run, canonical_url: 'https://example.com/post', published_at: new Date().toISOString() });
  assert.equal(duplicate.error?.code, '23505');
  assert.equal((await clients[0].from('listings').insert({ owner_id: owners[0], post_id: posts[0] })).error?.code, '23505');
  assert.ok((await clients[0].from('sources').update({ enabled: true }).eq('id', sources[0])).error);
});

test('storage is private and another user cannot download, overwrite, sign or delete an image', async () => {
  ok((await clients[0].storage.from('listing-images').download(paths[0])).error);
  assert.ok((await clients[0].storage.from('listing-images').download(paths[1])).error);
  assert.ok((await clients[0].storage.from('listing-images').createSignedUrl(paths[1], 60)).error);
  assert.ok((await clients[0].storage.from('listing-images').upload(paths[1], png, { contentType: 'image/png', upsert: true })).error);
  await clients[0].storage.from('listing-images').remove([paths[1]]);
  ok((await clients[1].storage.from('listing-images').download(paths[1])).error);
  const publicUrl = clients[0].storage.from('listing-images').getPublicUrl(paths[0]).data.publicUrl;
  assert.ok(!(await fetch(publicUrl)).ok);
});

test('expired posts, listings, image metadata and image bytes are excluded', async () => {
  const old = new Date(); old.setUTCFullYear(old.getUTCFullYear() - 1);
  ok((await admin.from('posts').update({ published_at: old.toISOString() }).eq('id', posts[0])).error);
  for (const [table, field, value] of [['posts', 'id', posts[0]], ['listings', 'id', listings[0]], ['listing_images', 'storage_path', paths[0]]]) {
    const result = await clients[0].from(table).select('*').eq(field, value); ok(result.error); assert.deepEqual(result.data, []);
  }
  assert.ok((await clients[0].storage.from('listing-images').download(paths[0])).error);
});
