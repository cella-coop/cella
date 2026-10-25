import { defineEnvVars } from '@sveltejs/kit/env'

// The server's settings. The database is found by the PG* variables, as
// `cella serve` sets them, or by DATABASE_URL.
export const variables = defineEnvVars({
  CELLA_DEV: {
    description:
      'Dev mode: "1" lets the sign-in page offer the fixture members, whose TEST-ONLY device keys the browser derives. `cella serve` sets it; `cella serve --prod` and nothing else must not.',
    schema: (v) => v === '1',
  },
  CELLA_SESSION_KEY_FILE: {
    description: 'The 32-byte key the server MACs its sessions with. Unset, a fresh key per process, whose sessions end with it.',
    schema: (v) => v || undefined,
  },
  DATABASE_URL: {
    description: 'The database, when not found by the PG* variables.',
    schema: (v) => v || undefined,
  },
})
