// Signing in, end to end on a seeded Lanterne, against the built server
// outside dev mode, as a scope's server runs. Camille invites someone by
// a link; in a real browser they open it, and the browser makes their
// first device, a key it keeps and cannot export, which signs its own
// acceptance; signed in, they rename themselves from their page, and that
// device signs the write; they sign out and sign in again with it. A
// request with no session, a write signed by another device than the
// session's, a proof posted to someone else's write and a revoked device
// are refused. Each browser takes up its own invitation.

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { open, random, sha256, signer } from '@cella/org-sign'
import { browsers } from './browser.ts'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)

const camille = 'camille@lanterne.example'
const hugo = 'hugo@lanterne.example'

const one = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows[0] as R

before(async () => {
  await su.connect()
  await shell.start('2026-10-24')
})

after(async () => {
  await shell.stop()
  await su.end()
})

for (const [name, engine] of browsers()) {
  describe(name, () => {
    const sam = `sam-${name}@lanterne.example`
    const secret = random()

    it('Camille invites Sam by a link, which only the link holds', async () => {
      const done = await shell.act('/people', 'invite', { name: 'Sam Petit', address: sam, link: await sha256(secret) }, camille)
      assert.equal(done.state, 'settled', done.reason)
      assert.equal((await one<{ n: number }>('SELECT count(*)::int AS n FROM membership.link WHERE member = $1', [sam])).n, 1)
    })

    it('Sam takes it up in the browser, which makes, keeps and signs with a key it cannot export', async () => {
      const browser = await engine.launch()
      try {
        const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))
        const base = shell.base
        // Firefox reports a module whose load a navigation cut off as the
        // page's error, so each page settles before the next.
        const visit = async (path: string) => {
          const res = await page.goto(`${base}${path}`)
          await page.waitForLoadState('networkidle')
          return res
        }

        const signedOut = await visit('/people')
        assert.match(page.url(), /\/sign-in\?back=%2Fpeople$/, 'with no session, a page goes to the sign-in')
        assert.equal(signedOut?.status(), 200)
        assert.ok(await page.getByText('This browser holds no device of lanterne.example').isVisible())

        await visit(`/join/${secret}`)
        assert.ok(await page.getByRole('heading', { name: 'Join Lanterne' }).isVisible())
        await page.getByLabel('This device').fill('laptop')
        await page.getByRole('button', { name: 'Take up the invitation' }).click()
        await page.waitForURL(`${base}/people/${encodeURIComponent(sam)}?tab=joining`)
        await page.waitForLoadState('networkidle')

        const device = await one<{ key: string; label: string; enrolled_by: string | null }>(
          `SELECT encode(key, 'hex') AS key, label, enrolled_by FROM person.device WHERE address = $1`,
          [sam],
        )
        assert.deepEqual([device.label, device.enrolled_by], ['laptop', null], 'the acceptance enrolled the first device, by no device')
        const kept = await page.evaluate(
          () =>
            new Promise<{ key: string; extractable: boolean }[]>((resolve, reject) => {
              const req = indexedDB.open('cella')
              req.onerror = () => reject(req.error)
              req.onsuccess = () => {
                const all = req.result.transaction('devices').objectStore('devices').getAll()
                all.onsuccess = () => resolve(all.result.map((d: { key: string; secret: CryptoKey }) => ({ key: d.key, extractable: d.secret.extractable })))
              }
            }),
        )
        assert.deepEqual(kept, [{ key: device.key, extractable: false }], 'the browser keeps the enrolled key, and cannot export it')
        const accepted = await one<{ device: string }>(`SELECT encode(device, 'hex') AS device FROM cella.receipt WHERE op = 'membership:member:accept' AND actor = $1`, [sam])
        assert.equal(accepted.device, device.key, 'the device signed its own acceptance')
        assert.equal((await visit(`/join/${secret}`))?.status(), 404, 'the link is spent')

        await visit(`/people/${encodeURIComponent(sam)}`)
        const profile = page.locator('form[action^="?/profile"]')
        await profile.getByLabel('Name').fill('Sam Petit-Roux')
        await profile.getByRole('button', { name: 'Rename' }).click()
        for (let i = 0; i < 50 && (await one<{ name: string }>('SELECT name FROM person.person WHERE address = $1', [sam])).name !== 'Sam Petit-Roux'; i++) {
          await page.waitForTimeout(100)
        }
        const renamed = await one<{ op: string; device: string }>(`SELECT op, encode(device, 'hex') AS device FROM cella.receipt WHERE actor = $1 ORDER BY n DESC LIMIT 1`, [sam])
        assert.deepEqual(renamed, { op: 'person:person:profile', device: device.key }, 'the write was signed in the browser by its device')

        await page.getByRole('button', { name: /^Account: / }).click()
        await page.getByRole('button', { name: 'Sign out' }).click()
        await page.waitForURL(`${base}/sign-in`)
        await page.waitForLoadState('networkidle')
        await page.getByRole('button', { name: `Sign in as ${sam} · laptop` }).click()
        await page.waitForURL(`${base}/`)
        await page.waitForLoadState('networkidle')
        assert.ok(await page.getByText('Sam Petit-Roux').first().isVisible(), 'signed in again, on the same device')

        await su.query(`UPDATE person.device SET revoked = '2026-10-24' WHERE key = decode($1, 'hex')`, [device.key])
        await visit('/people')
        assert.match(page.url(), /\/sign-in\?back=%2Fpeople$/, 'a revoked device\'s session opens nothing')
        assert.deepEqual(errors, [], 'the pages threw nothing')
      } finally {
        await browser.close()
      }
    })
  })
}

describe('what the server refuses', () => {
  it('a write signed by another device than the session\'s is refused by the notary', async () => {
    const cookie = await shell.signIn(camille)
    const asked = await shell.post('/people', 'invite', new URLSearchParams({ name: 'Mona', address: 'mona@lanterne.example' }), cookie)
    assert.ok(asked.sign, 'the server asks the session\'s device to sign')
    const proof = await signer(asked.sign.scope, asked.sign.actor, await shell.device(hugo))(asked.sign.op, asked.sign.request)
    const answer = await shell.post('/people', 'invite', new URLSearchParams({ 'cella-run': asked.sign.run, 'cella-proof': JSON.stringify(proof) }), cookie)
    assert.equal(answer.done?.state, 'refused', answer.done?.reason)
    assert.equal((await one<{ n: number }>(`SELECT count(*)::int AS n FROM membership.member WHERE address = 'mona@lanterne.example'`)).n, 0)
  })

  it('a proof posted to someone else\'s write is not taken', async () => {
    const asked = await shell.post('/people', 'invite', new URLSearchParams({ name: 'Oscar', address: 'oscar@lanterne.example' }), await shell.signIn(camille))
    assert.ok(asked.sign)
    const proof = await signer(asked.sign.scope, hugo, await shell.device(hugo))(asked.sign.op, asked.sign.request)
    const answer = await shell.post('/people', 'invite', new URLSearchParams({ 'cella-run': asked.sign.run, 'cella-proof': JSON.stringify(proof) }), await shell.signIn(hugo))
    assert.equal(answer.status, 409)
    assert.match(answer.done?.reason ?? '', /not yours to sign/)
  })

  it('a sign-in signed by another device, or answering a challenge twice, opens no session', async () => {
    const { challenge, scope } = (await (await fetch(`${shell.base}/session`)).json()) as { challenge: string; scope: string }
    const hugos = await shell.device(hugo)
    const sig = await open(scope, camille, hugos, challenge)
    const post = (body: object) =>
      fetch(`${shell.base}/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const forged = await post({ actor: camille, device: hugos.key, challenge, sig })
    assert.equal(forged.status, 403, 'Hugo\'s device is not Camille\'s')
    const fresh = (await (await fetch(`${shell.base}/session`)).json()) as { challenge: string }
    const right = { actor: hugo, device: hugos.key, challenge: fresh.challenge, sig: await open(scope, hugo, hugos, fresh.challenge) }
    assert.equal((await post(right)).status, 200)
    assert.equal((await post(right)).status, 403, 'a challenge opens one session')
  })

  it('the log verifies', async () => {
    assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
  })
})
