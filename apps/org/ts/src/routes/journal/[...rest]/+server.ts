import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

// The journal's old address: the collection is the transactions now, and
// a link kept from before still lands on the same entry.
export const GET: RequestHandler = ({ params, url }) => {
  redirect(308, `/transactions${params.rest ? `/${params.rest}` : ''}${url.search}`)
}
