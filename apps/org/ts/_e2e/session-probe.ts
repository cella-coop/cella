// The probe a host's NixOS test runs to open a session alone, no write:
// signs in as a fixture member with their TEST-ONLY device, as a demo's
// sign-in offers, and prints the `cella-session` cookie the server set,
// so a VM test can carry it on a request of its own, apart from the
// front's own visitor cookie. It reads the member's device from the
// scope's database by the PG* variables, as a superuser. Through a
// visiting demo's front, which knows a visitor by a cookie,
// `PROBE_COOKIE` is that cookie, sent with every request, so this probe
// signs in to that visitor's own copy, in its room.
// Usage: node apps/org/ts/_e2e/session-probe.ts BASE [ACTOR]

import pg from 'pg'
import { Shell } from './serve.ts'

const [base, actor = 'camille@lanterne.example'] = process.argv.slice(2)
if (!base) {
  throw new Error('session-probe: name the server, such as http://127.0.0.1:3000')
}
const visitor = process.env.PROBE_COOKIE
if (visitor) {
  const send = globalThis.fetch
  globalThis.fetch = (input: Parameters<typeof fetch>[0], init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    headers.set('cookie', [visitor, headers.get('cookie')].filter(Boolean).join('; '))
    return send(input, { ...init, headers })
  }
}
const su = new pg.Client()
await su.connect()
try {
  const shell = new Shell(su)
  shell.attach(base)
  console.log(await shell.signIn(actor))
} finally {
  await su.end()
}
