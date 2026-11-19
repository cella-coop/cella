// The canonical form, the browser's and the database's: the TypeScript
// canonicaliser the editor previews with and the Rust one the database
// names versions by (`cella.document_canonical`, over a Loro snapshot)
// write the same bytes, hash and text for hundreds of random bodies, and
// refuse the same ones. Run by `cella test slice body`, on a database
// holding the app's core alone.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { createDoc, tree } from '../src/models/blocks.ts'
import { create } from '../src/models/edits.ts'
import { blank, canonical, hash, jcs, plain } from '../src/models/canonical.ts'
import { edit, rng, seeded, sync } from './random.ts'

const db = new pg.Client()

type Out = { canonical: string; hash: string; text: string } | { refused: string }

async function rust(bytes: Uint8Array): Promise<Out> {
  await db.query('SAVEPOINT s')
  try {
    const { rows } = await db.query<{ canonical: string; hash: string; text: string }>(
      `SELECT cella.document_canonical($1) AS canonical, encode(cella.document_hash($1), 'hex') AS hash, cella.document_text($1) AS text`,
      [bytes],
    )
    await db.query('RELEASE SAVEPOINT s')
    return rows[0]
  } catch (e) {
    await db.query('ROLLBACK TO SAVEPOINT s')
    return { refused: (e as Error).message }
  }
}

function ts(doc: ReturnType<typeof createDoc>): Out {
  try {
    const c = canonical(doc)
    return { canonical: jcs(c), hash: hash(doc), text: plain(c) }
  } catch (e) {
    return { refused: (e as Error).message }
  }
}

before(async () => {
  await db.connect()
  await db.query('BEGIN')
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('the browser and the database agree, byte for byte, on 300 random bodies', async () => {
  let refused = 0
  for (let i = 0; i < 300; i++) {
    const r = rng(7000 + i)
    const doc = seeded(BigInt(i + 1))
    // Some bodies are made by two peers editing at once and merging.
    const other = createDoc(BigInt(100_000 + i))
    other.import(doc.export({ mode: 'snapshot' }))
    for (let k = r.int(60); k > 0; k--) {
      edit(r.next() < 0.7 ? doc : other, r)
      doc.commit()
      other.commit()
    }
    sync(other, doc)
    const mine = ts(doc)
    const theirs = await rust(doc.export({ mode: 'snapshot' }))
    if ('refused' in mine || 'refused' in theirs) {
      assert.ok('refused' in mine && 'refused' in theirs, `seed ${7000 + i}: one refused, the other did not: ${JSON.stringify([mine, theirs])}`)
      refused++
      continue
    }
    assert.equal(theirs.canonical, mine.canonical, `seed ${7000 + i}`)
    assert.equal(theirs.hash, mine.hash, `seed ${7000 + i}`)
    assert.equal(theirs.text, mine.text, `seed ${7000 + i}`)
    // Updates canonicalise as the snapshot does.
    const updates = await rust(doc.export({ mode: 'update' }))
    assert.deepEqual(updates, theirs)
  }
  assert.equal(refused, 0, 'random edits keep a canonical form')
})

test('both refuse a number that is not an integer, an unknown type, and bytes that are not Loro', async () => {
  const doc = createDoc(1)
  const h = create(doc, undefined, 0, 'heading', { level: 1.5 })
  doc.commit()
  assert.ok('refused' in ts(doc))
  assert.match((await rust(doc.export({ mode: 'snapshot' })) as { refused: string }).refused, /not an integer/)
  tree(doc).getNodeByID(h)?.data.set('level', 2)
  tree(doc).getNodeByID(h)?.data.set('type', 'table')
  doc.commit()
  assert.ok('refused' in ts(doc))
  assert.match((await rust(doc.export({ mode: 'snapshot' })) as { refused: string }).refused, /unknown block type "table"/)
  assert.match(((await rust(new Uint8Array([1, 2, 3]))) as { refused: string }).refused, /not a Loro document/)
})

test('an empty body is its empty form', async () => {
  const empty = createDoc(1)
  assert.deepEqual(await rust(empty.export({ mode: 'snapshot' })), ts(empty))
  assert.equal((ts(empty) as { canonical: string }).canonical, '{"blocks":[],"v":1}')
})

test('a body is blank where no one wrote in it: none, or empty text blocks; a divider or an embed is written', () => {
  assert.ok(blank(null) && blank(undefined) && blank({ v: 1, blocks: [] }))
  assert.ok(blank({ v: 1, blocks: [{ type: 'paragraph' }, { type: 'heading', runs: [{ text: '  ' }], children: [{ type: 'bullet' }] }] }))
  assert.ok(!blank({ v: 1, blocks: [{ type: 'paragraph' }, { type: 'bullet', children: [{ type: 'paragraph', runs: [{ text: 'a note' }] }] }] }))
  assert.ok(!blank({ v: 1, blocks: [{ type: 'divider' }] }))
  assert.ok(!blank({ v: 1, blocks: [{ type: 'embed', embed: 'motion', ref: 'm-1' }] }))
})
