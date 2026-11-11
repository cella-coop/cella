import type { Actions } from '@sveltejs/kit'
import { writes } from '#lib/server/slices.ts'
import { perform } from '#lib/server/write.ts'

// An item's page reads through the `item` query
// (`#lib/remote/item.remote.ts`); its writes are its slices'.
export const actions = Object.fromEntries(
  writes.map((w) => [w, (event: Parameters<Actions[string]>[0]) => perform(event, event.params.collection ?? '', w, event.params.id)]),
) satisfies Actions
