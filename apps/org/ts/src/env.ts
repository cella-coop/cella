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
  CELLA_DEMO: {
    description:
      'Demo mode: "1" lets a production build\'s sign-in offer the fixture members, each marked as a demo member, whose TEST-ONLY device keys the browser derives, and puts the demo\'s banner on every page. `cella serve --prod --demo` and the NixOS module\'s demo option set it, on a demo scope alone: never a real co-op\'s.',
    schema: (v) => v === '1',
  },
  CELLA_DEMO_IDLE: {
    description:
      "A visitor's copy of the demo, as `cella demo serve` starts each: how many seconds with no request before the copy resets, which the demo's banner counts down beside its Reset now. Unset, a demo that is no visitor's copy, with neither.",
    schema: (v) => (v ? whole(v, 'CELLA_DEMO_IDLE') : 0),
  },
  CELLA_DEMO_ENDS: {
    description:
      "A visitor's copy of the demo: when it resets however busy, in seconds since 1970, which `cella demo serve` sets from its lifetime; the banner counts down to it where it comes before the idle reset. Unset, no such end.",
    schema: (v) => (v ? whole(v, 'CELLA_DEMO_ENDS') : 0),
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
