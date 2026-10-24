import { defineEnvVars } from '@sveltejs/kit/env'

// The server's settings. The database is found by the PG* variables, as
// `cella serve` sets them, or by DATABASE_URL.
export const variables = defineEnvVars({
  CELLA_DEV: {
    description: 'Dev mode: "1" lets the server sign as a member with their fixture device key. `cella serve` sets it; nothing else should.',
    schema: (v) => v === '1',
  },
  DATABASE_URL: {
    description: 'The database, when not found by the PG* variables.',
    schema: (v) => v || undefined,
  },
})
