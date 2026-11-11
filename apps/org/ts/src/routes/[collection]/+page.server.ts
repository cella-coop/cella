import type { Actions } from '@sveltejs/kit'
import { writes } from '#lib/server/slices.ts'
import { perform } from '#lib/server/write.ts'

// A collection's page reads through the `collection` query
// (`#lib/remote/collection.remote.ts`); its writes are its slices'.
export const actions = Object.fromEntries(
  writes.map((w) => [w, (event: Parameters<Actions[string]>[0]) => perform(event, event.params.collection ?? '', w)]),
) satisfies Actions
