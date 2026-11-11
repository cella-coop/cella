import { defineEnvVars } from '@sveltejs/kit/env'

// A setting that is a whole number above zero.
function whole(v: string, name: string): number {
  const n = Number(v)
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`${name} is a whole number above zero, not ${v}`)
  }
  return n
}

// The server's settings. The database is found by the PG* variables, as
// `cella serve` sets them, or by DATABASE_URL.
export const variables = defineEnvVars({
  CELLA_DEV: {
    description:
      'Dev mode: "1" lets the sign-in page offer the fixture members, whose TEST-ONLY device keys the browser derives. `cella serve` and `cella preview serve` set it; `cella serve --prod` and nothing else must not.',
    schema: (v) => v === '1',
  },
  CELLA_SESSION_KEY_FILE: {
    description: 'The 32-byte key the server MACs its sessions with. Unset, a fresh key per process, whose sessions end with it.',
    schema: (v) => v || undefined,
  },
  CELLA_PATIENCE: {
    description: "How many seconds a write waits for each signature from the member's device before it fails. Unset, 60.",
    schema: (v) => (v ? whole(v, 'CELLA_PATIENCE') : 60),
  },
  CELLA_PENDING: {
    description: 'How many writes the server lets wait on a signature at once, across everyone; a person has at most three of them. Unset, 64.',
    schema: (v) => (v ? whole(v, 'CELLA_PENDING') : 64),
  },
  DATABASE_URL: {
    description: 'The database, when not found by the PG* variables.',
    schema: (v) => v || undefined,
  },
})
