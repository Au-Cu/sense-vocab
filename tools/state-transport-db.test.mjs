import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const url = process.env.SENSE_VOCAB_TEST_DATABASE_URL;
if (!url || process.env.SENSE_VOCAB_TEST_DISPOSABLE !== '1' || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
  throw new Error('This test requires an explicitly supplied disposable localhost PostgreSQL database.');
}
const require = createRequire(import.meta.url);
const { Client } = require(process.env.SENSE_VOCAB_TEST_PG_MODULE || 'pg');
const ownerId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const migration = '20261015125641_optimize_state_transport_locking.sql';
let admin;
let reader;
let writer;

async function sql(name) {
  return (await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
}
async function installFunction(file, name, rename = name) {
  const source = await sql(file);
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `Missing fixture function ${name}`);
  const end = source.indexOf('$$;', start) + 3;
  let body = source.slice(start, end).replace(`public.${name}(`, `public.${rename}(`);
  if (rename === 'save_user_state_legacy') body = body.replaceAll('12582912', '67108864').replaceAll('12 MB limit', '64 MB transport safety limit');
  await admin.query(body);
}
async function connect(id = null, authenticated = false) {
  const client = new Client({ connectionString: url });
  await client.connect();
  if (id) await client.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  if (authenticated) await client.query('set role authenticated');
  return client;
}

before(async () => {
  admin = await connect();
  const inventory = await admin.query("select count(*)::int as tables from pg_tables where schemaname not in ('pg_catalog','information_schema')");
  assert.equal(inventory.rows[0].tables, 0, 'Refusing to change an existing database.');
  await admin.query(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${ownerId}',null),('${otherId}',null);
  `);
  const base = await sql('202607280001_cloud_accounts.sql');
  await admin.query(`${base.slice(0, base.indexOf('create or replace function public.handle_new_user'))}\ncommit;`);
  const recovery = await sql('202607310001_state_recovery_guard.sql');
  await admin.query(`${recovery.slice(0, recovery.indexOf('create or replace function public.user_state_document'))}\ncommit;`);
  await admin.query('alter table public.user_state_meta add column transport_state jsonb, add column transport_bytes bigint');
  for (const name of ['user_state_document','sync_record_declares_delete']) await installFunction('202607310001_state_recovery_guard.sql', name);
  for (const name of ['confusion_links_are_valid','state_confusion_links_are_valid','enforce_state_confusion_links']) await installFunction('20260808150845_confusion_links_account_sync_guard.sql', name);
  await installFunction('20260808150845_confusion_links_account_sync_guard.sql','state_has_undeclared_deletions','state_has_undeclared_deletions_unexpanded');
  await installFunction('20260808150845_confusion_links_account_sync_guard.sql','state_has_undeclared_deletions','state_has_undeclared_deletions_reference');
  for (const name of ['compact_user_session_transport','compact_user_state_transport','state_has_learning_evidence']) await installFunction('20261001180000_compact_session_and_delta_guards.sql', name);
  for (const name of ['expand_user_state_transport','state_has_undeclared_deletions']) await installFunction('20261003090913_fix_compact_full_upload_deletion_guard.sql', name);
  await installFunction('20261001090000_materialize_user_state_transport.sql', 'materialize_user_state_transport');
  await installFunction('20260929151638_optimize_user_state_sync.sql','save_user_state','save_user_state_legacy');
  await installFunction('20261003090913_fix_compact_full_upload_deletion_guard.sql','save_user_state');
  await installFunction('20261001180000_compact_session_and_delta_guards.sql','save_user_state_delta');
  const chunks = await sql('20261001200000_chunked_user_state_transport.sql');
  await admin.query(chunks);
  await installFunction('20261002100000_fix_chunk_repair_hot_path.sql','ensure_user_state_transport_chunks');
  await installFunction('20261002090000_repair_chunk_transport_and_admin_dashboard.sql','load_user_state_chunk');
  await admin.query(await sql('20261002130000_staged_state_uploads.sql'));
  await admin.query(await sql('20261003035519_fix_staged_upload_progress_and_throughput.sql'));
  await admin.query(await sql('20261003091607_avoid_duplicate_transport_chunk_rebuild.sql'));
  await admin.query(`
    create trigger user_state_meta_confusion_links_guard before insert or update of extra_state on public.user_state_meta for each row execute function public.enforce_state_confusion_links();
    revoke all on function public.load_user_state_chunk(bigint,integer) from public,anon;
    grant execute on function public.load_user_state_chunk(bigint,integer) to authenticated;
  `);
  if (process.env.SENSE_VOCAB_TEST_BEFORE !== '1') await admin.query(await sql(migration));
  await admin.query("insert into public.user_state_meta(user_id,revision) values ($1,7)", [ownerId]);
  await admin.query("update public.user_state_meta set transport_chunk_count=1 where user_id=$1", [ownerId]);
  await admin.query("insert into public.user_state_transport_chunks(user_id,revision,chunk_index,chunk_count,chunk_data,chunk_bytes) values ($1,7,0,1,'{}',2)", [ownerId]);
  reader = await connect(ownerId, true);
  writer = await connect(ownerId);
}, { timeout: 60000 });

after(async () => {
  for (const client of [reader, writer, admin]) {
    if (client) { await client.query('rollback').catch(() => {}); await client.end(); }
  }
});

test('revision-pinned reads do not wait for a committing writer', async () => {
  await writer.query('begin');
  await writer.query('select revision from public.user_state_meta where user_id=$1 for update', [ownerId]);
  await reader.query("set lock_timeout='100ms'");
  try {
    const started = performance.now();
    const result = await reader.query('select public.load_user_state_chunk(7,0) as chunk');
    assert.equal(result.rows[0].chunk.found, true);
    assert.equal(result.rows[0].chunk.data, '{}');
    assert.ok(performance.now() - started < 2000);
  } finally {
    await writer.query('rollback');
    await reader.query("set lock_timeout='8s'");
  }
});

test('staging preflight does not take the authoritative write lock', async () => {
  await writer.query('begin');
  await writer.query('select revision from public.user_state_meta where user_id=$1 for update', [ownerId]);
  try {
    const result = await reader.query("select public.begin_user_state_upload('00000000-0000-4000-8000-000000000010',7,false,'fixture',1,2) as result");
    assert.equal(result.rows[0].result.ok, true);
  } finally { await writer.query('rollback'); }
});

test('byte chunks preserve UTF-8 boundaries and exact JSON content', async () => {
  const samples = ['', 'a'.repeat(1111), 'a\u4e2d\u6587\ud83d\ude00'.repeat(121)];
  for (const sample of samples) {
    for (const limit of [4, 5, 7, 13, 400000]) {
      const { rows } = await admin.query('select * from public.split_user_state_transport($1,$2)', [sample, limit]);
      assert.equal(rows.map(row => row.chunk_data).join(''), sample);
      rows.forEach((row, index) => {
        assert.equal(row.chunk_index, index);
        assert.equal(row.chunk_count, rows.length);
        assert.equal(Number(row.chunk_bytes), Buffer.byteLength(row.chunk_data));
        assert.ok(Number(row.chunk_bytes) <= limit);
      });
    }
  }
});

test('set-based deletion protection matches the original field-level rules', async () => {
  const book = { introducedWords: ['alpha','beta'], progress: { a: { status: 'review' }, b: { status: 'mastered' } },
    activityLog: { '2026-10-14': { newWords: 40 } }, studyWindows: [{ id: 'w1' }, { id: 'w2' }],
    confusionLinks: { pair: { left: 'alpha', right: 'beta' } } };
  const existing = { bookStates: { kaoyan: book, ielts: {} } };
  const cases = [structuredClone(existing)];
  for (const [domain,key] of [['progress','a'],['activityLog','2026-10-14'],['confusionLinks','pair'],['introducedWords','alpha'],['studyWindows','w1']]) {
    const removed = structuredClone(existing);
    if (domain === 'introducedWords') removed.bookStates.kaoyan[domain].shift();
    else if (domain === 'studyWindows') removed.bookStates.kaoyan[domain].shift();
    else delete removed.bookStates.kaoyan[domain][key];
    cases.push(removed);
    const declared = structuredClone(removed);
    declared.bookStates.kaoyan._sync = { records: { [domain]: { [key]: { deleted: true } } } };
    cases.push(declared);
  }
  cases.push({ bookStates: {} });
  for (const incoming of cases) {
    const result = await admin.query('select public.state_has_undeclared_deletions_reference($1,$2) as original, public.state_has_undeclared_deletions_unexpanded($1,$2) as optimized', [existing, incoming]);
    assert.equal(result.rows[0].optimized, result.rows[0].original);
  }
});

test('RPCs remain account-scoped and internal helpers remain inaccessible', async () => {
  const other = await connect(otherId, true);
  try {
    const result = await other.query('select public.load_user_state_chunk(7,0) as chunk');
    assert.equal(result.rows[0].chunk.found, false);
    await assert.rejects(reader.query("select * from public.split_user_state_transport('text',4)"), { code: '42501' });
    const publicRole = await connect();
    try {
      await publicRole.query('set role anon');
      await assert.rejects(publicRole.query('select public.load_user_state_chunk(7,0)'), { code: '42501' });
    } finally { await publicRole.end(); }
  } finally { await other.end(); }
});

test('a complete large staged upload commits all learning domains atomically', async () => {
  const progress = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`word-${i}:n-1`, { status: 'review', nextReviewAt: '2026-10-16', lastReviewedAt: '2026-10-15' }]));
  const state = { schemaVersion: 1, activeBookId: 'kaoyan', bookStates: { ielts: {} },
    plan: { dailyNew: 40 }, session: null, progress,
    introducedWords: Array.from({ length: 5000 }, (_, i) => `word-${i}`),
    activityLog: { '2026-10-15': { newWords: 45, reviewWords: 57 } },
    studyWindows: [{ id: 'complete-window', endedAt: '2026-10-15T12:00:00Z' }],
    dashboardSnapshots: Object.fromEntries(Array.from({ length: 32 }, (_, i) => [`fixture-${i}`, { progress }])),
  };
  const payload = JSON.stringify(state);
  assert.ok(Buffer.byteLength(payload) > 12 * 1024 * 1024);
  const parts = payload.match(/[\s\S]{1,1000000}/g);
  const uploadId = '00000000-0000-4000-8000-000000000011';
  const begun = await reader.query('select public.begin_user_state_upload($1,7,false,$2,$3,$4) as result', [uploadId, 'large-fixture', parts.length, Buffer.byteLength(payload)]);
  assert.equal(begun.rows[0].result.ok, true);
  for (const [index, part] of parts.entries()) {
    const saved = await reader.query('select public.put_user_state_upload_part($1,$2,$3,$4) as result', [uploadId,index,parts.length,part]);
    assert.equal(saved.rows[0].result.ok, true);
  }
  const completed = await reader.query('select public.finalize_user_state_upload($1) as result', [uploadId]);
  assert.equal(completed.rows[0].result.ok, true);
  assert.equal(completed.rows[0].result.revision, 8);
  const summary = await admin.query(`select revision,transport_chunk_count,
    (select count(*)::int from public.sense_progress where user_id=$1) as senses,
    (select count(*)::int from public.daily_activity where user_id=$1) as days,
    (select count(*)::int from public.study_windows where user_id=$1) as windows,
    (select count(*)::int from public.user_state_upload_sessions where user_id=$1 and upload_id=$2) as pending
    from public.user_state_meta where user_id=$1`, [ownerId,uploadId]);
  assert.equal(Number(summary.rows[0].revision), 8);
  assert.equal(summary.rows[0].senses, 5000);
  assert.equal(summary.rows[0].windows, 1);
  assert.equal(summary.rows[0].pending, 0);
  assert.ok(summary.rows[0].transport_chunk_count > 1);
  assert.equal(summary.rows[0].days, 1);
}, { timeout: 120000 });

test('large reads stay nonblocking and stale revisions cannot overwrite progress', async () => {
  await writer.query('begin');
  await writer.query('select revision from public.user_state_meta where user_id=$1 for update', [ownerId]);
  try {
    const result = await reader.query('select public.load_user_state_chunk(8,0) as chunk');
    assert.equal(result.rows[0].chunk.found, true);
    assert.equal(result.rows[0].chunk.revision, 8);
  } finally { await writer.query('rollback'); }
  const old = await reader.query("select public.begin_user_state_upload('00000000-0000-4000-8000-000000000012',7,false,'stale',1,2) as result");
  assert.equal(old.rows[0].result.conflict, true);
  const stale = await reader.query('select public.load_user_state_chunk(7,0) as chunk');
  assert.equal(stale.rows[0].chunk.stale, true);
});

test('cold repair remains resumable without waiting on a writer or losing history', async () => {
  const before = await admin.query('select transport_bytes from public.user_state_meta where user_id=$1', [ownerId]);
  await admin.query('delete from public.user_state_transport_chunks where user_id=$1 and revision=8 and chunk_index=1', [ownerId]);
  await writer.query('begin');
  await writer.query('select revision from public.user_state_meta where user_id=$1 for update', [ownerId]);
  try {
    const busy = await reader.query('select public.load_user_state_chunk(8,1) as chunk');
    assert.equal(busy.rows[0].chunk.found, false);
    assert.equal(busy.rows[0].chunk.stale, true);
  } finally { await writer.query('rollback'); }
  const repaired = await reader.query('select public.load_user_state_chunk(8,1) as chunk');
  assert.equal(repaired.rows[0].chunk.found, true);
  const verified = await admin.query(`select m.revision,m.transport_bytes,
    sum(c.chunk_bytes) as chunk_bytes,
    (string_agg(c.chunk_data,'' order by c.chunk_index)::jsonb->'state')=m.transport_state as exact
    from public.user_state_meta m join public.user_state_transport_chunks c
    on c.user_id=m.user_id and c.revision=m.revision where m.user_id=$1
    group by m.user_id`, [ownerId]);
  assert.equal(verified.rows[0].exact, true);
  assert.equal(verified.rows[0].transport_bytes, before.rows[0].transport_bytes);
  assert.equal(verified.rows[0].chunk_bytes, before.rows[0].transport_bytes);
  assert.equal(Number(verified.rows[0].revision), 8);
});

test('two concurrent writers cannot both commit the same revision', async () => {
  const contender = await connect(ownerId, true);
  try {
    const query = 'select public.save_user_state(m.transport_state,8,false) as result from public.user_state_meta m where user_id=auth.uid()';
    // The lookup is deliberately exposed only in this disposable fixture.
    await admin.query('grant select on public.user_state_meta to authenticated');
    const results = await Promise.all([reader.query(query), contender.query(query)]);
    assert.equal(results.filter(result => result.rows[0].result.ok).length, 1);
    assert.equal(results.filter(result => result.rows[0].result.conflict).length, 1);
    const summary = await admin.query('select revision,(select count(*) from public.sense_progress where user_id=$1) as senses from public.user_state_meta where user_id=$1',[ownerId]);
    assert.equal(Number(summary.rows[0].revision),9);
    assert.equal(Number(summary.rows[0].senses),5000);
  } finally { await contender.end(); }
}, { timeout: 60000 });

test('incremental writes retain history and update normalized calendar dates', async () => {
  const patch = { version: 1, activeBookId: 'kaoyan', books: { kaoyan: {
    maps: { activityLog: { upsert: { '2026-10-16': { newWords: 1 } } } },
  } } };
  const result = await reader.query('select public.save_user_state_delta($1,9,false) as result', [patch]);
  assert.equal(result.rows[0].result.ok, true);
  const summary = await admin.query('select count(*)::int as days,max(activity_date)::text as latest from public.daily_activity where user_id=$1',[ownerId]);
  assert.deepEqual(summary.rows[0], { days: 2, latest: '2026-10-16' });
}, { timeout: 60000 });
