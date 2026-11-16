// The probe a host's NixOS test runs against a scope's server, which a
// unit of the module runs: signs in as a fixture member with their
// TEST-ONLY device, as a demo's sign-in offers, and makes one write
// through the notary, Camille inviting someone by a link, each signature
// the server asks for signed by that device as the browser signs it.
// Prints the write's outcome as JSON and fails unless it settled. It
// reads the member's device from the scope's database by the PG*
// variables, as a superuser.
// Usage: node apps/org/ts/_e2e/probe.ts BASE [ACTOR]

import pg from 'pg'
import { random, sha256 } from '@cella/org-sign'
import { Shell } from './serve.ts'

const [base, actor = 'camille@lanterne.example'] = process.argv.slice(2)
if (!base) {
  throw new Error('probe: name the server, such as http://127.0.0.1:3000')
}
const su = new pg.Client()
await su.connect()
try {
  const shell = new Shell(su)
  shell.attach(base)
  const invitee = `probe-${Date.now()}@lanterne.example`
  const done = await shell.act('/people', 'invite', { name: 'Probe Petit', address: invitee, link: await sha256(random()) }, actor)
  console.log(JSON.stringify({ actor, op: done.op, state: done.state, entry: done.entry, reason: done.reason, signed: shell.signed }))
  if (done.state !== 'settled') {
    process.exitCode = 1
  }
} finally {
  await su.end()
}
