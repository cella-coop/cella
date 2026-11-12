import { error } from '@sveltejs/kit'
import type { Joining } from '@cella/org-db'
import { using } from '#lib/server/db.ts'
import { joining } from '#lib/server/slices.ts'
import type { PageServerLoad } from './$types'

const gone = 'This invitation link is taken up already, or is no one’s'

// The slice that serves invitations (`joins`, the membership feat's); with
// none mounted, every link is no one's.
const serving = (): Joining => joining ?? error(404, gone)

// An invitation's link: whom it invites, while they have not taken it up.
// Taking it up is the `accept` command (`#lib/remote/session.remote.ts`).
export const load: PageServerLoad = async ({ params }) => {
  const join = serving()
  const invited = await using(null, (db) => join.invited(db, params.secret))
  if (!invited) {
    error(404, gone)
  }
  return { invited }
}
