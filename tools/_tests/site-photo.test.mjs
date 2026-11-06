import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { photoUrl, checkPhotos, add } from '../site-photo.mjs'
import { createRequire } from 'node:module'
const sharp = createRequire(new URL('../../packages/brand/package.json', import.meta.url))('sharp')

const credit = { photographer: 'Ada Example', photographerUrl: 'https://unsplash.com/@ada', photoUrl: 'https://unsplash.com/photos/aBc123', id: 'aBc123', licence: 'Unsplash License', licenceUrl: 'https://unsplash.com/license' }
test('only Unsplash photo pages and safe names', () => {
  assert.deepEqual(photoUrl('https://unsplash.com/photos/aBc123?utm_source=cella'), { page: credit.photoUrl, id: credit.id })
  for (const url of ['https://evil.test/photos/aBc123', 'http://unsplash.com/photos/aBc123', 'https://unsplash.com/photos/../../oops']) assert.throws(() => photoUrl(url))
})
test('each image needs a complete, linked credit; each credit needs an image', () => {
  const dir = mkdtempSync(join(tmpdir(), 'site-photos-'))
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'a.jpg'), 'image')
    assert.throws(() => checkPhotos(dir), /missing json/)
    writeFileSync(join(dir, 'a.json'), JSON.stringify(credit))
    checkPhotos(dir)
    writeFileSync(join(dir, 'a.json'), JSON.stringify({ ...credit, photographerUrl: 'https://other.test/@ada' }))
    assert.throws(() => checkPhotos(dir), /invalid photographer profile/)
    writeFileSync(join(dir, 'a.json'), JSON.stringify({ ...credit, licence: '' }))
    assert.throws(() => checkPhotos(dir), /incomplete Unsplash credit/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('public download prompts for attribution without network', async () => {
  const root = mkdtempSync(join(tmpdir(), 'site-photo-public-'))
  const fixture = JSON.parse(readFileSync(new URL('brand/explorer-print.json', import.meta.url), 'utf8'))
  const jpeg = await sharp(Buffer.from(fixture.input, 'base64'), { raw: { width: fixture.width, height: fixture.height, channels: 4 } }).jpeg().toBuffer()
  const previous = process.env.UNSPLASH_ACCESS_KEY
  delete process.env.UNSPLASH_ACCESS_KEY
  const questions = []
  try {
    await add(credit.photoUrl, root, 'public', {
      request: async (url) => url === credit.photoUrl
        ? { ok: true, text: async () => '<meta property="og:image" content="https://images.unsplash.com/photo-fixture">' }
        : { ok: true, arrayBuffer: async () => jpeg },
      ask: async (question) => { questions.push(question); return questions.length === 1 ? credit.photographer : credit.photographerUrl },
    })
    assert.equal(questions.length, 2)
    assert.deepEqual(JSON.parse(readFileSync(join(root, 'src/photos/public.json'), 'utf8')), credit)
  } finally {
    if (previous === undefined) delete process.env.UNSPLASH_ACCESS_KEY
    else process.env.UNSPLASH_ACCESS_KEY = previous
    rmSync(root, { recursive: true, force: true })
  }
})

test('API download is tracked, converted and credited without network', async () => {
  const root = mkdtempSync(join(tmpdir(), 'site-photo-add-'))
  const fixture = JSON.parse(readFileSync(new URL('brand/explorer-print.json', import.meta.url), 'utf8'))
  const jpeg = await sharp(Buffer.from(fixture.input, 'base64'), { raw: { width: fixture.width, height: fixture.height, channels: 4 } }).jpeg().toBuffer()
  const calls = []
  const request = async (url) => {
    calls.push(url)
    if (url.includes('api.unsplash.com/photos/')) return { ok: true, json: async () => ({ id: 'aBc123', user: { name: 'Ada Example', username: 'ada' }, links: { download_location: 'https://api.unsplash.com/download/aBc123' } }) }
    if (url.includes('/download/')) return { ok: true, json: async () => ({ url: 'https://images.unsplash.com/photo-fixture' }) }
    return { ok: true, arrayBuffer: async () => jpeg }
  }
  const previous = process.env.UNSPLASH_ACCESS_KEY
  process.env.UNSPLASH_ACCESS_KEY = 'test-key'
  try {
    await add(credit.photoUrl, root, 'fixture', { request })
    assert.equal(calls.length, 3)
    assert.equal(calls[1], 'https://api.unsplash.com/download/aBc123')
    const dir = join(root, 'src/photos')
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'fixture.json'), 'utf8')), credit)
    checkPhotos(dir)
    assert.ok((await sharp(join(dir, 'fixture.jpg')).metadata()).width > 0)
    const { loadPhoto, creditParts } = await import('../../apps/site/src/lib/photo.ts')
    const cwd = process.cwd()
    try {
      process.chdir(root)
      const printed = await loadPhoto('fixture', 'house')
      assert.match(printed.masks, /--print-/)
      assert.equal(printed.printed.masks.length, 1)
      assert.deepEqual(creditParts('Photo by {name} on {unsplash}'), { beforeName: 'Photo by ', between: ' on ', afterUnsplash: '' })
      assert.match((await loadPhoto('fixture', 'none')).original, /^data:image\/jpeg;base64,/)
      await assert.rejects(loadPhoto('missing', 'house'))
    } finally { process.chdir(cwd) }
  } finally {
    if (previous === undefined) delete process.env.UNSPLASH_ACCESS_KEY
    else process.env.UNSPLASH_ACCESS_KEY = previous
    rmSync(root, { recursive: true, force: true })
  }
})
